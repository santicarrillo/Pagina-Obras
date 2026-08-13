import { initializeApp } from 'firebase/app';
import { FIREBASE_CONFIG } from './config';

export const firebaseApp = initializeApp(FIREBASE_CONFIG);