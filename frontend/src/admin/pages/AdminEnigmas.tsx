import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { adminEnigmasAPI, adminUploadAPI } from '../services/adminAPI';
import { EnigmaWithStats, CreateEnigmaRequest, EnigmaHint } from '../types';
import './AdminEnigmas.css';

const AdminEnigmas: React.FC = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingEnigma, setEditingEnigma] = useState<EnigmaWithStats | null>(null);
  const [orderedEnigmas, setOrderedEnigmas] = useState<EnigmaWithStats[]>([]);
  const [formData, setFormData] = useState<CreateEnigmaRequest>({
    enigmaNumber: 1,
    title: '',
    correctPassword: '',
    pdfUrl: '',
    solution: '',
    hints: [],
    isActive: true,
  });
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminEnigmas'],
    queryFn: adminEnigmasAPI.listAll,
  });

  React.useEffect(() => {
    if (data?.enigmas) {
      setOrderedEnigmas([...data.enigmas].sort((a, b) => a.enigmaNumber - b.enigmaNumber));
    }
  }, [data]);

  const createMutation = useMutation({
    mutationFn: adminEnigmasAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEnigmas'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ enigmaId, data }: { enigmaId: string; data: Partial<CreateEnigmaRequest> }) =>
      adminEnigmasAPI.update(enigmaId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEnigmas'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminEnigmasAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEnigmas'] });
    },
  });

  const resetForm = () => {
    setFormData({
      enigmaNumber: orderedEnigmas.length + 1,  // Auto-set to next number
      title: '',
      correctPassword: '',
      pdfUrl: '',
      solution: '',
      hints: [],
      isActive: true,
    });
    setEditingEnigma(null);
    setShowForm(false);
  };

  const handleEdit = (enigma: EnigmaWithStats) => {
    setEditingEnigma(enigma);
    setFormData({
      enigmaNumber: enigma.enigmaNumber,
      title: enigma.title,
      correctPassword: '', // Don't populate for security
      pdfUrl: enigma.pdfUrl,
      solution: enigma.solution || '',
      hints: enigma.hints ? enigma.hints.map((h) => ({ ...h })) : [],
      isActive: enigma.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare data - only send correctPassword if it has been filled
    const dataToSend: Partial<CreateEnigmaRequest> = { ...formData };
    if (editingEnigma && !formData.correctPassword) {
      // If editing and password field is empty, don't send it (keep existing password)
      const { correctPassword, ...rest } = dataToSend;
      if (editingEnigma) {
        updateMutation.mutate({ enigmaId: editingEnigma.enigmaId, data: rest });
      }
    } else if (editingEnigma) {
      updateMutation.mutate({ enigmaId: editingEnigma.enigmaId, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend as CreateEnigmaRequest);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Seuls les fichiers PDF sont acceptés');
      return;
    }

    try {
      setUploadingPdf(true);
      setUploadProgress('Génération de l\'URL d\'upload...');

      // Step 1: Get presigned URL from backend
      const { uploadUrl, fileUrl } = await adminUploadAPI.generateUploadUrl();

      setUploadProgress('Upload du PDF vers S3...');

      // Step 2: Upload PDF to S3
      await adminUploadAPI.uploadPdf(uploadUrl, file);

      setUploadProgress('Upload terminé !');

      // Step 3: Update form data with the file URL
      setFormData({ ...formData, pdfUrl: fileUrl });

      setTimeout(() => {
        setUploadProgress('');
        setUploadingPdf(false);
      }, 1500);
    } catch (error: any) {
      console.error('PDF upload failed:', error);
      alert('Échec de l\'upload du PDF: ' + (error.response?.data?.error || error.message));
      setUploadProgress('');
      setUploadingPdf(false);
    }
  };

  // --- Liste d'indices ---------------------------------------------------
  // Les identifiants servent de cle stable cote serveur : une demande archivee
  // renvoie a l'identifiant de l'indice livre. On ne les reattribue donc jamais
  // lors d'un reordonnancement, seul `order` change.

  const indices = formData.hints || [];

  const majIndices = (nouveaux: EnigmaHint[]) => {
    setFormData({ ...formData, hints: nouveaux.map((h, i) => ({ ...h, order: i + 1 })) });
  };

  const ajouterIndice = () => {
    const existants = new Set(indices.map((h) => h.id));
    let n = indices.length + 1;
    while (existants.has(`h${n}`)) n += 1;
    majIndices([...indices, { id: `h${n}`, order: indices.length + 1, text: '' }]);
  };

  const modifierIndice = (index: number, texte: string) => {
    majIndices(indices.map((h, i) => (i === index ? { ...h, text: texte } : h)));
  };

  const supprimerIndice = (index: number) => {
    majIndices(indices.filter((_, i) => i !== index));
  };

  const deplacerIndice = (index: number, delta: number) => {
    const cible = index + delta;
    if (cible < 0 || cible >= indices.length) return;
    const copie = [...indices];
    const [retire] = copie.splice(index, 1);
    copie.splice(cible, 0, retire);
    majIndices(copie);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    const items = Array.from(orderedEnigmas);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for smooth UX
    setOrderedEnigmas(items);

    // Update enigma numbers based on new order - only send enigmaNumber
    const updatePromises = items.map((enigma, index) => {
      const newNumber = index + 1;
      if (enigma.enigmaNumber !== newNumber) {
        // Only update the enigma number, don't send password
        return adminEnigmasAPI.update(enigma.enigmaId, {
          enigmaNumber: newNumber,
        });
      }
      return Promise.resolve();
    });

    // Send updates to backend
    try {
      await Promise.all(updatePromises);
      // Update the local enigma objects with new numbers
      const updatedItems = items.map((enigma, index) => ({
        ...enigma,
        enigmaNumber: index + 1,
      }));
      setOrderedEnigmas(updatedItems);
    } catch (error) {
      console.error('Failed to reorder enigmas:', error);
      // Revert on error
      if (data?.enigmas) {
        setOrderedEnigmas([...data.enigmas].sort((a, b) => a.enigmaNumber - b.enigmaNumber));
      }
    }
  };

  if (isLoading) return <div data-testid="admin-enigmas-loading" className="loading">Chargement des énigmes...</div>;
  if (error) return <div data-testid="admin-enigmas-error" className="error">Échec du chargement des énigmes</div>;

  return (
    <div data-testid="admin-enigmas-page" className="admin-enigmas">
      <div className="admin-page-header">
        <div>
          <h1>Gestion des énigmes</h1>
          <p className="admin-page-subtitle">Créer, modifier et gérer les énigmes du jeu</p>
        </div>
        <button data-testid="admin-enigmas-new-button"
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Annuler' : '+ Nouvelle énigme'}
        </button>
      </div>

      {showForm && (
        <div className="enigma-form-container card">
          <h2>{editingEnigma ? 'Modifier l\'énigme' : 'Créer une nouvelle énigme'}</h2>
          <form data-testid="admin-enigmas-form" onSubmit={handleSubmit} className="enigma-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="enigma-title">Nom de l'énigme *</label>
                <input data-testid="admin-enigmas-title-input"
                  id="enigma-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="Ex: Le Mystère de la Tour Eiffel"
                />
                <small className="form-help">Le nom qui apparaîtra aux joueurs</small>
              </div>

              <div className="form-group">
                <label htmlFor="enigma-password">Mot de passe (solution) *</label>
                <input data-testid="admin-enigmas-password-input"
                  id="enigma-password"
                  type="text"
                  value={formData.correctPassword}
                  onChange={(e) => setFormData({ ...formData, correctPassword: e.target.value.toUpperCase() })}
                  required
                  placeholder="Ex: PARIS1889"
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                />
                <small className="form-help">Le mot de passe sera converti en majuscules</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="enigma-pdf">Fichier PDF de l'énigme *</label>
                <div className="pdf-upload-container">
                  <input data-testid="admin-enigmas-pdf-input"
                    id="enigma-pdf-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handlePdfUpload}
                    disabled={uploadingPdf}
                    style={{ marginBottom: '10px' }}
                  />
                  {uploadingPdf && (
                    <div className="upload-progress">
                      <span className="spinner">⏳</span> {uploadProgress}
                    </div>
                  )}
                  {formData.pdfUrl && !uploadingPdf && (
                    <div className="pdf-url-display">
                      <span className="pdf-success">✓ PDF uploadé</span>
                      <a href={formData.pdfUrl} target="_blank" rel="noopener noreferrer" className="pdf-preview-link">
                        📄 Voir le PDF
                      </a>
                    </div>
                  )}
                </div>
                <small className="form-help">Sélectionnez un fichier PDF à uploader sur S3</small>
              </div>

            </div>

            <div className="form-row">
              <div className="form-group form-group-full">
                <label htmlFor="enigma-solution">Solution détaillée</label>
                <textarea
                  data-testid="admin-enigmas-solution-input"
                  id="enigma-solution"
                  value={formData.solution || ''}
                  onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                  rows={10}
                  placeholder={"Démarche attendue, étape par étape.\n\nMentionnez explicitement les fausses pistes cachées et à quoi on les reconnaît dans le texte d'une équipe : c'est ce qui permet de repérer une équipe égarée."}
                />
                <small className="form-help">
                  Confidentielle. Elle ne sort jamais du serveur : elle sert uniquement à choisir
                  l'indice adapté à l'avancement décrit par l'équipe.
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group form-group-full">
                <label>Indices, du plus précoce au plus tardif</label>
                <div className="hints-editor" data-testid="admin-enigmas-hints-editor">
                  {indices.length === 0 && (
                    <p className="hints-empty" data-testid="admin-enigmas-hints-empty">
                      Aucun indice. Sans indice, les équipes ne peuvent pas en demander sur cette énigme.
                    </p>
                  )}
                  {indices.map((indice, index) => (
                    <div className="hint-row" key={indice.id} data-testid={`admin-enigmas-hint-row-${indice.id}`}>
                      <div className="hint-row-head">
                        <span className="hint-row-rank">Indice {index + 1}</span>
                        <span className="hint-row-id">identifiant {indice.id}</span>
                        <div className="hint-row-actions">
                          <button
                            type="button"
                            className="btn btn-small btn-secondary"
                            data-testid={`admin-enigmas-hint-up-${indice.id}`}
                            onClick={() => deplacerIndice(index, -1)}
                            disabled={index === 0}
                          >
                            Monter
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-secondary"
                            data-testid={`admin-enigmas-hint-down-${indice.id}`}
                            onClick={() => deplacerIndice(index, 1)}
                            disabled={index === indices.length - 1}
                          >
                            Descendre
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-danger"
                            data-testid={`admin-enigmas-hint-remove-${indice.id}`}
                            onClick={() => supprimerIndice(index)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                      <textarea
                        className="hint-row-text"
                        data-testid={`admin-enigmas-hint-text-${indice.id}`}
                        value={indice.text}
                        onChange={(e) => modifierIndice(index, e.target.value)}
                        rows={3}
                        placeholder="Texte de l'indice, tel qu'il sera affiché à l'équipe."
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="admin-enigmas-hint-add"
                    onClick={ajouterIndice}
                  >
                    + Ajouter un indice
                  </button>
                </div>
                <small className="form-help">
                  L'ordre compte : le premier indice est le plus léger, le dernier celui qui permet
                  de conclure. Un indice déjà donné à une équipe garde son identifiant.
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="enigma-active">Statut de publication</label>
                <div className="toggle-container">
                  <label className="toggle-switch">
                    <input data-testid="admin-enigmas-active-toggle"
                      id="enigma-active"
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className={`toggle-label ${formData.isActive ? 'active' : 'inactive'}`}>
                    {formData.isActive ? '✓ Publiée' : '✗ Non publiée'}
                  </span>
                </div>
                <small className="form-help">Les énigmes non publiées ne sont pas visibles aux joueurs</small>
              </div>
            </div>

            {editingEnigma && (
              <div className="form-note">
                <strong>Note:</strong> Le numéro de l'énigme (#{formData.enigmaNumber}) est géré automatiquement via le glisser-déposer.
              </div>
            )}

            <div className="form-actions">
              <button data-testid="admin-enigmas-submit" type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending || uploadingPdf}>
                {editingEnigma ? '💾 Mettre à jour' : '✨ Créer l\'énigme'}
              </button>
              <button data-testid="admin-enigmas-cancel" type="button" className="btn btn-secondary" onClick={resetForm}>
                Annuler
              </button>
              {editingEnigma && (
                <button data-testid="admin-enigmas-delete"
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${editingEnigma.title}" ?`)) {
                      deleteMutation.mutate(editingEnigma.enigmaId);
                      resetForm();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  🗑️ Supprimer l'énigme
                </button>
              )}
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <div data-testid="admin-enigmas-form-error" className="form-error">
                Erreur: {(createMutation.error as any)?.response?.data?.error || 'Une erreur est survenue'}
              </div>
            )}
          </form>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="enigmas-list">
          <table data-testid="admin-enigmas-table" className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }}></th>
                <th style={{ width: '50px' }}>#</th>
                <th>Titre</th>
                <th style={{ width: '150px' }}>Stats</th>
                <th style={{ width: '80px' }}>PDF</th>
                <th style={{ width: '60px' }}>Indices</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <Droppable droppableId="enigmas">
              {(provided) => (
                <tbody {...provided.droppableProps} ref={provided.innerRef}>
                  {orderedEnigmas.map((enigma, index) => (
                    <Draggable key={enigma.enigmaId} draggableId={enigma.enigmaId} index={index}>
                      {(provided, snapshot) => (
                        <tr data-testid={`admin-enigmas-row-${enigma.enigmaId}`}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${snapshot.isDragging ? 'dragging' : ''} ${!enigma.isActive ? 'unpublished' : ''}`}
                        >
                          <td {...provided.dragHandleProps} className="drag-handle">
                            ⋮⋮
                          </td>
                          <td className="enigma-number">#{enigma.enigmaNumber}</td>
                          <td>
                            <div className="enigma-title">
                              {enigma.title}
                              {!enigma.isActive && <span className="unpublished-label">non publiée</span>}
                            </div>
                          </td>
                          <td className="enigma-stats">
                            {enigma.teamsSolved > 0 ? (
                              <span>{enigma.teamsSolved} équipe{enigma.teamsSolved > 1 ? 's' : ''} l'ont résolue</span>
                            ) : (
                              <span className="no-stats">Pas encore résolue</span>
                            )}
                          </td>
                          <td>
                            {enigma.pdfUrl ? (
                              <a
                                href={enigma.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pdf-link"
                              >
                                📄 PDF
                              </a>
                            ) : (
                              <span className="no-pdf">-</span>
                            )}
                          </td>
                          <td>
                            {enigma.hints && enigma.hints.length > 0 ? (
                              <span className="hint-count" title="Indices pré-écrits">
                                {enigma.hints.length}
                              </span>
                            ) : (
                              <span className="no-hint">-</span>
                            )}
                          </td>
                          <td className="actions">
                            <button data-testid={`admin-enigmas-edit-button-${enigma.enigmaId}`}
                              className="btn btn-small btn-secondary"
                              onClick={() => handleEdit(enigma)}
                            >
                              Modifier
                            </button>
                          </td>
                        </tr>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </table>

          {orderedEnigmas.length === 0 && (
            <div data-testid="admin-enigmas-empty" className="empty-state">
              <p>Aucune énigme créée pour le moment. Cliquez sur "Nouvelle énigme" pour commencer.</p>
            </div>
          )}
        </div>
      </DragDropContext>
    </div>
  );
};

export default AdminEnigmas;
