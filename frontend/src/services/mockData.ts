import { Enigma, Parcours, TeamStats } from '../types';

// Mock data for development before backend is ready
export const mockEnigmas: Enigma[] = [
  { id: '1', title: 'Enigma 1: Le Début', order: 1, isSolved: true, points: 10 },
  { id: '2', title: 'Enigma 2: Le Motif', order: 2, isSolved: true, points: 15 },
  { id: '3', title: 'Enigma 3: Le Code', order: 3, isSolved: false, points: 20 },
  { id: '4', title: 'Enigma 4: La Clé', order: 4, isSolved: false, points: 15 },
  { id: '5', title: 'Enigma 5: Le Mystère', order: 5, isSolved: false, points: 25 },
  { id: '6', title: 'Enigma 6: La Suite', order: 6, isSolved: false, points: 20 },
  { id: '7', title: 'Enigma 7: Le Puzzle', order: 7, isSolved: false, points: 30 },
  { id: '8', title: 'Enigma 8: La Logique', order: 8, isSolved: false, points: 15 },
  { id: '9', title: 'Enigma 9: Le Labyrinthe', order: 9, isSolved: false, points: 25 },
  { id: '10', title: 'Enigma 10: La Série', order: 10, isSolved: false, points: 20 },
  { id: '11', title: 'Enigma 11: Le Symbole', order: 11, isSolved: false, points: 30 },
  { id: '12', title: 'Enigma 12: La Carte', order: 12, isSolved: false, points: 25 },
  { id: '13', title: 'Enigma 13: Le Chiffre', order: 13, isSolved: false, points: 20 },
  { id: '14', title: 'Enigma 14: La Question', order: 14, isSolved: false, points: 35 },
  { id: '15', title: 'Enigma 15: Le Défi', order: 15, isSolved: false, points: 25 },
  { id: '16', title: 'Enigma 16: La Réponse', order: 16, isSolved: false, points: 30 },
  { id: '17', title: 'Enigma 17: Le Secret', order: 17, isSolved: false, points: 40 },
  { id: '18', title: 'Enigma 18: La Découverte', order: 18, isSolved: false, points: 35 },
  { id: '19', title: 'Enigma 19: La Révélation', order: 19, isSolved: false, points: 45 },
  { id: '20', title: 'Enigma 20: La Finale', order: 20, isSolved: false, points: 50 },
];

export const mockParcours: Parcours[] = [
  {
    id: 'p1',
    title: 'Parcours A: Historique',
    order: 1,
    isUnlocked: true,
    requiredEnigmas: 2,
    solvedEnigmas: 2,
  },
  {
    id: 'p2',
    title: 'Parcours B: Culturel',
    order: 2,
    isUnlocked: false,
    requiredEnigmas: 4,
    solvedEnigmas: 2,
  },
  {
    id: 'p3',
    title: 'Parcours C: Scientifique',
    order: 3,
    isUnlocked: false,
    requiredEnigmas: 6,
    solvedEnigmas: 2,
  },
  {
    id: 'p4',
    title: 'Parcours D: Artistique',
    order: 4,
    isUnlocked: false,
    requiredEnigmas: 8,
    solvedEnigmas: 2,
  },
  {
    id: 'p5',
    title: 'Parcours E: Géographique',
    order: 5,
    isUnlocked: false,
    requiredEnigmas: 10,
    solvedEnigmas: 2,
  },
  {
    id: 'p6',
    title: 'Parcours F: Mathématique',
    order: 6,
    isUnlocked: false,
    requiredEnigmas: 12,
    solvedEnigmas: 2,
  },
  {
    id: 'p7',
    title: 'Parcours G: Littéraire',
    order: 7,
    isUnlocked: false,
    requiredEnigmas: 14,
    solvedEnigmas: 2,
  },
  {
    id: 'p8',
    title: 'Parcours H: Musical',
    order: 8,
    isUnlocked: false,
    requiredEnigmas: 16,
    solvedEnigmas: 2,
  },
  {
    id: 'p9',
    title: 'Parcours I: Sportif',
    order: 9,
    isUnlocked: false,
    requiredEnigmas: 18,
    solvedEnigmas: 2,
  },
  {
    id: 'p10',
    title: 'Parcours J: Final',
    order: 10,
    isUnlocked: false,
    requiredEnigmas: 20,
    solvedEnigmas: 2,
  },
];

export const mockTeamStats: TeamStats = {
  teamName: 'Les Aventuriers',
  memberCount: 4,
  enigmasSolved: 2,
  totalEnigmas: 20,
  parcoursCompleted: 1,
  totalParcours: 10,
  totalPoints: 25,
  passwordAttemptsCount: 15,
  attemptsRanking: 45,
  attemptsRankingMessage: 'Votre équipe est dans la moyenne.',
};

// Mock PDF URL (placeholder)
export const mockPdfUrl = 'data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSIAogICAgPj4KICA+PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2JqCgo1IDAgb2JqICAlIHBhZ2UgY29udGVudAo8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9GMSAxMiBUZgooRW5pZ21hIFBERikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAxIDAwMDAwIG4gCjAwMDAwMDAzODAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDkyCiUlRU9G';
