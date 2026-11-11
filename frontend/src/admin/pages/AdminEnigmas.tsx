import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { adminEnigmasAPI, adminUploadAPI } from '../services/adminAPI';
import { EnigmaWithStats, CreateEnigmaRequest, EnigmaHint, NearMiss } from '../types';
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
    hintsEnabled: false,
    hintsAvailableFrom: '',
    nearMisses: [],
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

  // Ouvrir ou fermer les indices d'une intrigue depuis la liste, sans passer par
  // le formulaire. Seul `hintsEnabled` part : le serveur ne réécrit que les
  // champs reçus (SET partiel), titre, mot de passe et indices restent intacts.
  // La liste bascule tout de suite, puis se recale sur le serveur.
  const [erreurBascule, setErreurBascule] = useState('');
  const basculeIndicesMutation = useMutation({
    mutationFn: ({ enigmaId, hintsEnabled }: { enigmaId: string; hintsEnabled: boolean }) =>
      adminEnigmasAPI.update(enigmaId, { hintsEnabled }),
    onMutate: async ({ enigmaId, hintsEnabled }) => {
      setErreurBascule('');
      await queryClient.cancelQueries({ queryKey: ['adminEnigmas'] });
      const avant = queryClient.getQueryData<{ enigmas: EnigmaWithStats[]; count: number }>(['adminEnigmas']);
      if (avant) {
        queryClient.setQueryData(['adminEnigmas'], {
          ...avant,
          enigmas: avant.enigmas.map((e) => (e.enigmaId === enigmaId ? { ...e, hintsEnabled } : e)),
        });
      }
      return { avant };
    },
    onError: (err: any, { hintsEnabled }, contexte) => {
      if (contexte?.avant) queryClient.setQueryData(['adminEnigmas'], contexte.avant);
      setErreurBascule(
        `Impossible de ${hintsEnabled ? 'ouvrir' : 'fermer'} les indices : ${
          err?.response?.data?.error || err?.message || 'erreur inconnue'
        }`
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEnigmas'] });
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
      hintsEnabled: false,
      hintsAvailableFrom: '',
      nearMisses: [],
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
      hintsEnabled: enigma.hintsEnabled === true,
      hintsAvailableFrom: enigma.hintsAvailableFrom || '',
      nearMisses: enigma.nearMisses ? enigma.nearMisses.map((n) => ({ ...n })) : [],
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

  // --- « Presques bons » mots de passe ------------------------------------
  // Autant de lignes que l'on veut. La liste part entière à chaque
  // enregistrement du formulaire et remplace l'ancienne côté serveur.

  const presqueBons = formData.nearMisses || [];

  const majPresqueBons = (nouveaux: NearMiss[]) => {
    setFormData({ ...formData, nearMisses: nouveaux });
  };

  const ajouterPresqueBon = () => {
    majPresqueBons([...presqueBons, { password: '', message: '' }]);
  };

  const modifierPresqueBon = (index: number, champ: keyof NearMiss, valeur: string) => {
    majPresqueBons(presqueBons.map((n, i) => (i === index ? { ...n, [champ]: valeur } : n)));
  };

  const supprimerPresqueBon = (index: number) => {
    majPresqueBons(presqueBons.filter((_, i) => i !== index));
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

  if (isLoading) return <div data-testid="admin-enigmas-loading" className="loading">Chargement des intrigues...</div>;
  if (error) return <div data-testid="admin-enigmas-error" className="error">Échec du chargement des intrigues</div>;

  return (
    <div data-testid="admin-enigmas-page" className="admin-enigmas">
      <div className="admin-page-header">
        <div>
          {/* Le formulaire remplace la liste au lieu de s'ouvrir au-dessus
              d'elle : voir les vingt intrigues défiler sous celle qu'on est en
              train de modifier ne disait pas où l'on se trouvait. */}
          {showForm ? (
            <>
              <button data-testid="admin-enigmas-back"
                type="button"
                className="btn btn-secondary btn-small admin-retour"
                onClick={resetForm}
              >
                ← Retour à la liste des intrigues
              </button>
              <h1>{editingEnigma ? `Modifier « ${editingEnigma.title} »` : 'Nouvelle intrigue'}</h1>
            </>
          ) : (
            <>
              <h1>Gestion des intrigues</h1>
              <p className="admin-page-subtitle">Créer, modifier et gérer les intrigues du jeu</p>
            </>
          )}
        </div>
        {!showForm && (
          <button data-testid="admin-enigmas-new-button"
            className="btn btn-primary"
            onClick={() => { setEditingEnigma(null); setShowForm(true); }}
          >
            + Nouvelle intrigue
          </button>
        )}
      </div>

      {showForm && (
        <div className="enigma-form-container card">
          <form data-testid="admin-enigmas-form" onSubmit={handleSubmit} className="enigma-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="enigma-title">Nom de l'intrigue *</label>
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
                <label htmlFor="enigma-password">
                  Mot de passe (solution){editingEnigma ? '' : ' *'}
                </label>
                <input data-testid="admin-enigmas-password-input"
                  id="enigma-password"
                  type="text"
                  value={formData.correctPassword}
                  onChange={(e) => setFormData({ ...formData, correctPassword: e.target.value.toUpperCase() })}
                  /* Le champ n'est jamais pré-rempli, et il n'est obligatoire
                     qu'à la création : le laisser obligatoire en modification
                     forçait à ressaisir le mot de passe pour corriger un
                     titre, alors que l'envoi sait déjà l'omettre quand il est
                     vide. */
                  required={!editingEnigma}
                  placeholder={editingEnigma ? 'Laisser vide pour ne pas le changer' : 'Ex: PARIS1889'}
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                />
                <small className="form-help">
                  {editingEnigma
                    ? 'Vide : le mot de passe actuel est conservé. Sinon il sera remplacé.'
                    : 'Le mot de passe sera converti en majuscules'}
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="enigma-pdf">Fichier PDF de l'intrigue *</label>
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
                <label>Presques bons mots de passe</label>
                <div className="hints-editor" data-testid="admin-enigmas-near-misses-editor">
                  {presqueBons.length === 0 && (
                    <p className="hints-empty" data-testid="admin-enigmas-near-misses-empty">
                      Aucun. Toute mauvaise réponse reçoit un message de refus tiré au hasard.
                    </p>
                  )}
                  {presqueBons.map((presque, index) => (
                    <div className="hint-row near-miss-row" key={index} data-testid={`admin-enigmas-near-miss-row-${index}`}>
                      <div className="hint-row-head">
                        <span className="hint-row-rank">Presque bon {index + 1}</span>
                        <div className="hint-row-actions">
                          <button
                            type="button"
                            className="btn btn-small btn-danger"
                            data-testid={`admin-enigmas-near-miss-remove-${index}`}
                            onClick={() => supprimerPresqueBon(index)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        className="near-miss-password"
                        data-testid={`admin-enigmas-near-miss-password-${index}`}
                        aria-label={`Mot de passe du presque bon ${index + 1}`}
                        value={presque.password}
                        onChange={(e) => modifierPresqueBon(index, 'password', e.target.value)}
                        maxLength={100}
                        required
                        placeholder="Mot de passe presque bon, ex. TOUR EIFFEL"
                        style={{ fontFamily: 'monospace' }}
                      />
                      <textarea
                        className="hint-row-text"
                        data-testid={`admin-enigmas-near-miss-message-${index}`}
                        aria-label={`Message du presque bon ${index + 1}`}
                        value={presque.message}
                        onChange={(e) => modifierPresqueBon(index, 'message', e.target.value)}
                        maxLength={500}
                        required
                        rows={2}
                        placeholder="Message affiché à l'équipe, ex. Vous chauffez : cherchez plutôt son architecte."
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="admin-enigmas-near-miss-add"
                    onClick={ajouterPresqueBon}
                  >
                    + Ajouter un presque bon
                  </button>
                </div>
                <small className="form-help">
                  Une équipe qui saisit l'un de ces mots de passe ne résout pas l'intrigue : elle reçoit
                  votre message à la place du refus habituel. Comme pour la solution, la casse, les
                  accents, les espaces et la ponctuation ne comptent pas. Jamais montrés aux joueurs.
                </small>
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
                      Aucun indice. Sans indice, les équipes ne peuvent pas en demander sur cette intrigue.
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

            {/* L'ouverture des indices est un choix de l'organisateur, énigme par
                énigme : jamais, tout de suite, ou à partir d'une date. Fermée par
                défaut, pour qu'on puisse rédiger les indices sans les exposer. */}
            <div className="form-row">
              <div className="form-group form-group-full">
                <label>Ouverture des indices aux équipes</label>
                <div className="hints-opening" data-testid="admin-enigmas-hints-opening">
                  <div className="toggle-container">
                    <label className="toggle-switch">
                      <input data-testid="admin-enigmas-hints-enabled"
                        id="enigma-hints-enabled"
                        type="checkbox"
                        checked={!!formData.hintsEnabled}
                        onChange={(e) => setFormData({ ...formData, hintsEnabled: e.target.checked })}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`toggle-label ${formData.hintsEnabled ? 'active' : 'inactive'}`}>
                      {formData.hintsEnabled ? '✓ Indices ouverts' : '✗ Indices fermés'}
                    </span>
                  </div>
                  <div className="hints-opening-date">
                    <label htmlFor="enigma-hints-from">à partir du</label>
                    <input
                      id="enigma-hints-from"
                      type="date"
                      data-testid="admin-enigmas-hints-from"
                      value={formData.hintsAvailableFrom || ''}
                      disabled={!formData.hintsEnabled}
                      onChange={(e) => setFormData({ ...formData, hintsAvailableFrom: e.target.value })}
                    />
                    {formData.hintsAvailableFrom && formData.hintsEnabled && (
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        data-testid="admin-enigmas-hints-from-clear"
                        onClick={() => setFormData({ ...formData, hintsAvailableFrom: '' })}
                      >
                        Ouvrir tout de suite
                      </button>
                    )}
                  </div>
                </div>
                <small className="form-help" data-testid="admin-enigmas-hints-opening-help">
                  {!formData.hintsEnabled
                    ? 'Les équipes ne voient pas le bouton d’indice sur cette intrigue.'
                    : formData.hintsAvailableFrom
                      ? `Les équipes pourront demander un indice à partir du ${new Date(formData.hintsAvailableFrom + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}, à minuit (heure de Paris).`
                      : 'Les équipes peuvent demander un indice dès maintenant.'}
                  {formData.hintsEnabled && indices.length === 0 && ' Attention : aucun indice n’est encore rédigé, le bouton restera masqué.'}
                  {formData.hintsEnabled && !(formData.solution || '').trim() && ' Attention : la solution détaillée est vide, le modèle choisira l’indice sans repère sur la démarche attendue.'}
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
                <small className="form-help">Les intrigues non publiées ne sont pas visibles aux joueurs</small>
              </div>
            </div>

            {editingEnigma && (
              <div className="form-note">
                <strong>Note:</strong> Le numéro de l'intrigue (#{formData.enigmaNumber}) est géré automatiquement via le glisser-déposer.
              </div>
            )}

            {/* Enregistrer et renoncer vont ensemble ; supprimer n'a rien à
                faire à côté d'eux — c'est une autre intention, et un clic de
                travers ne se rattrape pas. Il descend donc sous un filet. */}
            <div className="form-actions">
              <button data-testid="admin-enigmas-submit" type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending || uploadingPdf}>
                {editingEnigma ? '💾 Mettre à jour' : '✨ Créer l\'intrigue'}
              </button>
              <button data-testid="admin-enigmas-cancel" type="button" className="btn btn-secondary" onClick={resetForm}>
                Annuler
              </button>
            </div>

            {editingEnigma && (
              <div className="form-zone-danger">
                <div>
                  <strong>Supprimer cette intrigue</strong>
                  <p>Son énoncé, ses indices et la progression des équipes dessus disparaissent. Sans retour.</p>
                </div>
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
                  🗑️ Supprimer l'intrigue
                </button>
              </div>
            )}

            {(createMutation.isError || updateMutation.isError) && (
              <div data-testid="admin-enigmas-form-error" className="form-error">
                Erreur: {((createMutation.error || updateMutation.error) as any)?.response?.data?.error || 'Une erreur est survenue'}
              </div>
            )}
          </form>
        </div>
      )}

      {!showForm && (
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="enigmas-list">
          {erreurBascule && (
            <div className="admin-form-error" role="alert" data-testid="admin-enigmas-hints-toggle-error">
              {erreurBascule}
            </div>
          )}
          <table data-testid="admin-enigmas-table" className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }}></th>
                <th style={{ width: '50px' }}>#</th>
                <th>Titre</th>
                <th style={{ width: '150px' }}>Stats</th>
                <th style={{ width: '220px' }}>Indices</th>
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
                          <td className="admin-row-number">#{enigma.enigmaNumber}</td>
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
                            {/* Le nombre d'indices rédigés, et surtout leur état :
                                c'est ce que l'organisateur vient vérifier ici. */}
                            <span className="hints-cell" data-testid={`admin-enigmas-hints-status-${enigma.enigmaId}`}>
                              {enigma.hints && enigma.hints.length > 0 ? (
                                <span className="hint-count" title="Indices rédigés">{enigma.hints.length}</span>
                              ) : (
                                <span className="no-hint">-</span>
                              )}
                              {enigma.hintsEnabled !== true ? (
                                <span className="hints-state hints-state-ferme">fermés</span>
                              ) : !(enigma.hints || []).some((h) => (h.text || '').trim()) ? (
                                /* Ouverts, mais rien à donner : le bouton reste
                                   masqué côté équipe. On le signale. */
                                <span
                                  className="hints-state admin-badge--warning"
                                  data-testid={`admin-enigmas-hints-empty-${enigma.enigmaId}`}
                                  title="Aucun indice rédigé : les équipes ne voient pas le bouton"
                                >
                                  ouverts, sans indice
                                </span>
                              ) : enigma.hintsAvailableFrom && enigma.hintsAvailableFrom > new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }) ? (
                                <span className="hints-state hints-state-planifie">
                                  dès le {new Date(enigma.hintsAvailableFrom + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                </span>
                              ) : (
                                <span className="hints-state hints-state-ouvert">ouverts</span>
                              )}
                              <button
                                type="button"
                                className="btn btn-small btn-secondary"
                                data-testid={`admin-enigmas-hints-toggle-${enigma.enigmaId}`}
                                aria-label={`${enigma.hintsEnabled === true ? 'Fermer' : 'Ouvrir'} les indices de « ${enigma.title} »`}
                                disabled={
                                  basculeIndicesMutation.isPending &&
                                  basculeIndicesMutation.variables?.enigmaId === enigma.enigmaId
                                }
                                onClick={() =>
                                  basculeIndicesMutation.mutate({
                                    enigmaId: enigma.enigmaId,
                                    hintsEnabled: enigma.hintsEnabled !== true,
                                  })
                                }
                              >
                                {enigma.hintsEnabled === true ? 'Fermer' : 'Ouvrir'}
                              </button>
                            </span>
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
              <p>Aucune intrigue créée pour le moment. Cliquez sur "Nouvelle intrigue" pour commencer.</p>
            </div>
          )}
        </div>
      </DragDropContext>
      )}
    </div>
  );
};

export default AdminEnigmas;
