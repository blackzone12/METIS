import Dexie from 'dexie';

// Backend base URL: use env variable in dev, relative path when served by FastAPI
const BACKEND_URL = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL)
    ? process.env.NEXT_PUBLIC_API_URL
    : '';

// Initialize the IndexedDB database using Dexie.js for the METIS project
const db = new Dexie('MetisDatabase');

// Define the schema for the database
db.version(1).stores({
  // 1. Context Registry (Cards)
  // Stores learning material, flashcards, or contextual pieces of information.
  contextRegistry: '++id, deckId, title, content, type, tags, createdAt',

  // 2. Retention State SM-2 Tracking
  // Tracks the SuperMemo-2 (SM-2) spaced repetition algorithm metrics for each user & card.
  retentionState: '++id, cardId, userId, nextReviewDate, interval, easeFactor, repetitions, lastReviewed',

  // 3. Friction Telepathy - Empathy Log
  // Logs behavioral telemetry like cognitive friction, facial impact score, and interventions.
  frictionLogs: '++id, userId, sessionId, timestamp, cognitiveFrictionIndex, difficultyScore, attentionDrift, squintingDetected, downwardGaze, interventionTriggered'
});

export async function initDatabase() {
    try {
        await db.open();
        console.log('Metis IndexedDB initialized via Dexie.js successfully.');
    } catch (err) {
        console.error('Failed to open Metis database:', err);
    }
}

// ==========================================
// 1. Context Registry API
// ==========================================
export async function addContextCard(deckId, title, content, type, tags) {
    return await db.contextRegistry.add({
        deckId,
        title,
        content,
        type, // e.g., "math_problem", "analogy", "vocabulary"
        tags,
        createdAt: new Date().toISOString()
    });
}

export async function getCardsByDeck(deckId) {
    return await db.contextRegistry.where('deckId').equals(deckId).toArray();
}

// ==========================================
// 2. Retention State SM-2 Tracking API
// ==========================================
export async function initOrGetRetentionState(cardId, userId) {
    let state = await db.retentionState.where({ cardId, userId }).first();
    if (!state) {
        state = {
            cardId,
            userId,
            nextReviewDate: new Date().toISOString(),
            interval: 0,
            easeFactor: 2.5,
            repetitions: 0,
            lastReviewed: null
        };
        const id = await db.retentionState.add(state);
        state.id = id;
    }
    return state;
}

export async function updateSM2State(cardId, userId, quality) {
    // Quality is a score from 0-5 (SM-2 standard)
    // 5 = perfect response, 0 = complete blackout
    
    const state = await initOrGetRetentionState(cardId, userId);
    
    if (quality >= 3) {
        if (state.repetitions === 0) {
            state.interval = 1;
        } else if (state.repetitions === 1) {
            state.interval = 6;
        } else {
            state.interval = Math.round(state.interval * state.easeFactor);
        }
        state.repetitions += 1;
    } else {
        state.repetitions = 0;
        state.interval = 1;
    }

    state.easeFactor = state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (state.easeFactor < 1.3) state.easeFactor = 1.3;

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + state.interval);
    
    state.nextReviewDate = nextReview.toISOString();
    state.lastReviewed = new Date().toISOString();

    await db.retentionState.put(state);
    return state;
}

export async function getDueReviews(userId) {
    const now = new Date().toISOString();
    return await db.retentionState
        .where('userId').equals(userId)
        .and(record => record.nextReviewDate <= now)
        .toArray();
}

// ==========================================
// 3. Friction Telepathy - Empathy Log API
// ==========================================
export async function logFrictionEvent(userId, sessionId, metrics) {
    /*
      metrics: {
        cognitiveFrictionIndex: number,
        difficultyScore: number,
        attentionDrift: boolean,
        squintingDetected: boolean,
        downwardGaze: boolean,
        interventionTriggered: string | null
      }
    */
    return await db.frictionLogs.add({
        userId,
        sessionId,
        timestamp: new Date().toISOString(),
        ...metrics
    });
}

export async function getFrictionLogs(userId, sessionId) {
    return await db.frictionLogs
        .where({ userId, sessionId })
        .reverse()
        .sortBy('timestamp');
}

export default db;


// ==========================================
// 4. Backend Synchronization
// ==========================================
export async function syncLogsToBackend() {
    try {
        // Fetch all tables
        const frictionLogs = await db.frictionLogs.toArray();
        const contextRegistry = await db.contextRegistry.toArray();
        const retentionState = await db.retentionState.toArray();

        if (frictionLogs.length === 0 && contextRegistry.length === 0 && retentionState.length === 0) {
            console.log('No new data to sync.');
            return;
        }

        console.log(`Syncing ${frictionLogs.length} logs, ${contextRegistry.length} cards, ${retentionState.length} states to backend...`);
        
        const response = await fetch(`${BACKEND_URL}/api/sync/sync-logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                frictionLogs: frictionLogs,
                contextRegistry: contextRegistry,
                retentionState: retentionState
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Sync successful:', result);
            // Optionally clear data after sync:
            // await db.frictionLogs.clear();
        } else {
            console.error('Sync failed:', await response.text());
        }
    } catch (err) {
        console.error('Error during sync:', err);
    }
}
