import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { adminEnigmasAPI, adminUploadAPI } from '../services/adminAPI';
import { EnigmaWithStats, CreateEnigmaRequest } from '../types';
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

  if (isLoading) return <div className="loading">Chargement des énigmes...</div>;
  if (error) return <div className="error">Échec du chargement des énigmes</div>;

  return (
    <div className="admin-enigmas">
      <div className="admin-page-header">
        <div>
          <h1>Gestion des énigmes</h1>
          <p className="admin-page-subtitle">Créer, modifier et gérer les énigmes du jeu</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Annuler' : '+ Nouvelle énigme'}
        </button>
      </div>

      {showForm && (
        <div className="enigma-form-container card">
          <h2>{editingEnigma ? 'Modifier l\'énigme' : 'Créer une nouvelle énigme'}</h2>
          <form onSubmit={handleSubmit} className="enigma-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="enigma-title">Nom de l'énigme *</label>
                <input
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
                <input
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
                  <input
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

              <div className="form-group">
                <label htmlFor="enigma-active">Statut de publication</label>
                <div className="toggle-container">
                  <label className="toggle-switch">
                    <input
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
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending || uploadingPdf}>
                {editingEnigma ? '💾 Mettre à jour' : '✨ Créer l\'énigme'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Annuler
              </button>
              {editingEnigma && (
                <button
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
              <div className="form-error">
                Erreur: {(createMutation.error as any)?.response?.data?.error || 'Une erreur est survenue'}
              </div>
            )}
          </form>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="enigmas-list">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }}></th>
                <th style={{ width: '50px' }}>#</th>
                <th>Titre</th>
                <th style={{ width: '150px' }}>Stats</th>
                <th style={{ width: '80px' }}>PDF</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <Droppable droppableId="enigmas">
              {(provided) => (
                <tbody {...provided.droppableProps} ref={provided.innerRef}>
                  {orderedEnigmas.map((enigma, index) => (
                    <Draggable key={enigma.enigmaId} draggableId={enigma.enigmaId} index={index}>
                      {(provided, snapshot) => (
                        <tr
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
                          <td className="actions">
                            <button
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
            <div className="empty-state">
              <p>Aucune énigme créée pour le moment. Cliquez sur "Nouvelle énigme" pour commencer.</p>
            </div>
          )}
        </div>
      </DragDropContext>
    </div>
  );
};

export default AdminEnigmas;
