import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { adminParcoursAPI, adminUploadAPI } from '../services/adminAPI';
import { ParcoursWithStats, CreateParcoursRequest } from '../types';
import './AdminParcours.css';

const AdminParcours: React.FC = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingParcours, setEditingParcours] = useState<ParcoursWithStats | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [formData, setFormData] = useState<CreateParcoursRequest>({
    parcoursNumber: 1,
    title: '',
    pdfUrl: '',
    isActive: true,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminParcours'],
    queryFn: adminParcoursAPI.listAll,
  });

  const createMutation = useMutation({
    mutationFn: adminParcoursAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminParcours'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ parcoursId, data }: { parcoursId: string; data: Partial<CreateParcoursRequest> }) =>
      adminParcoursAPI.update(parcoursId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminParcours'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminParcoursAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminParcours'] });
    },
  });

  const resetForm = () => {
    setFormData({
      parcoursNumber: 1,
      title: '',
      pdfUrl: '',
      isActive: true,
    });
    setEditingParcours(null);
    setShowForm(false);
    setUploadProgress('');
  };

  const handleEdit = (parcours: ParcoursWithStats) => {
    setEditingParcours(parcours);
    setFormData({
      parcoursNumber: parcours.parcoursNumber,
      title: parcours.title,
      pdfUrl: parcours.pdfUrl,
      isActive: parcours.isActive,
    });
    setShowForm(true);
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

      const { uploadUrl, fileUrl } = await adminUploadAPI.generateUploadUrl();

      setUploadProgress('Upload du PDF vers S3...');
      await adminUploadAPI.uploadPdf(uploadUrl, file);

      setUploadProgress('Upload terminé !');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingParcours) {
      updateMutation.mutate({ parcoursId: editingParcours.parcoursId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(parcoursList);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update parcoursNumber for all affected items
    const updates = items.map((item, index) => ({
      ...item,
      parcoursNumber: index + 1,
    }));

    // Optimistically update the UI
    queryClient.setQueryData(['adminParcours'], { parcours: updates });

    // Send updates to backend
    try {
      await Promise.all(
        updates.map((parcours) =>
          adminParcoursAPI.update(parcours.parcoursId, {
            parcoursNumber: parcours.parcoursNumber,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['adminParcours'] });
    } catch (error) {
      console.error('Failed to reorder parcours:', error);
      queryClient.invalidateQueries({ queryKey: ['adminParcours'] });
      alert('Échec de la réorganisation des parcours');
    }
  };

  if (isLoading) return <div className="loading">Chargement des parcours...</div>;
  if (error) return <div className="error">Échec du chargement des parcours</div>;

  const parcoursList = data?.parcours || [];

  return (
    <div className="admin-parcours">
      <div className="admin-page-header">
        <div>
          <h1>Gestion des parcours</h1>
          <p className="admin-page-subtitle">Créer, modifier et gérer les parcours du jeu</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Annuler' : '+ Nouveau parcours'}
        </button>
      </div>

      {showForm && (
        <div className="parcours-form-container card">
          <h2>{editingParcours ? 'Modifier le parcours' : 'Ajouter un nouveau parcours'}</h2>
          <form onSubmit={handleSubmit} className="parcours-form">
            <div className="form-group">
              <label>Titre du parcours *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="Entrez le titre du parcours"
              />
            </div>

            <div className="form-group pdf-upload-container">
              <label>Fichier PDF</label>
              {formData.pdfUrl && (
                <div className="current-pdf">
                  <a href={formData.pdfUrl} target="_blank" rel="noopener noreferrer">
                    📄 Voir le PDF actuel
                  </a>
                </div>
              )}
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                disabled={uploadingPdf}
              />
              {uploadProgress && (
                <div className={uploadProgress.includes('terminé') ? 'pdf-success' : 'upload-progress'}>
                  {uploadProgress}
                </div>
              )}
            </div>

            <div className="form-group toggle-group">
              <label>Statut de publication</label>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  id="parcours-active"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <label htmlFor="parcours-active" className="toggle-label">
                  <span className="toggle-slider"></span>
                  <span className="toggle-text">
                    {formData.isActive ? 'Publiée' : 'Non publiée'}
                  </span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending || uploadingPdf}>
                {editingParcours ? 'Mettre à jour' : 'Créer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Annuler
              </button>
              {editingParcours && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${editingParcours.title}" ?`)) {
                      deleteMutation.mutate(editingParcours.parcoursId);
                      resetForm();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Supprimer
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="parcours-list">
        <DragDropContext onDragEnd={handleDragEnd}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }}></th>
                <th style={{ width: '50px' }}>#</th>
                <th>Titre</th>
                <th style={{ width: '200px' }}>Stats</th>
                <th style={{ width: '80px' }}>PDF</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <Droppable droppableId="parcours-list">
              {(provided) => (
                <tbody {...provided.droppableProps} ref={provided.innerRef}>
                  {parcoursList.map((parcours, index) => (
                    <Draggable
                      key={parcours.parcoursId}
                      draggableId={parcours.parcoursId}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${!parcours.isActive ? 'unpublished-row' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                        >
                          <td {...provided.dragHandleProps} className="drag-handle">
                            ⋮⋮
                          </td>
                          <td className="parcours-number">#{parcours.parcoursNumber}</td>
                          <td>
                            <div className="parcours-title">
                              {parcours.title}
                              {!parcours.isActive && <span className="unpublished-label">non publiée</span>}
                            </div>
                          </td>
                          <td className="parcours-stats">
                            {parcours.teamsUnlocked > 0 ? (
                              <span>{parcours.teamsUnlocked} équipe{parcours.teamsUnlocked > 1 ? 's' : ''} l'{parcours.teamsUnlocked > 1 ? 'ont' : 'a'} déverrouillé</span>
                            ) : (
                              <span className="no-stats">Pas encore déverrouillé</span>
                            )}
                          </td>
                          <td>
                            {parcours.pdfUrl ? (
                              <a href={parcours.pdfUrl} target="_blank" rel="noopener noreferrer" className="pdf-link">
                                📄 PDF
                              </a>
                            ) : (
                              <span className="no-pdf">-</span>
                            )}
                          </td>
                          <td className="actions">
                            <button className="btn btn-small btn-secondary" onClick={() => handleEdit(parcours)}>
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
        </DragDropContext>

        {parcoursList.length === 0 && (
          <div className="empty-state">
            <p>Aucun parcours créé pour le moment. Cliquez sur "+ Nouveau parcours" pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminParcours;
