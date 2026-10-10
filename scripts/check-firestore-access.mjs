import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeApp, deleteApp } from 'firebase/app'
import { collection, getDocs, getFirestore, terminate } from 'firebase/firestore'

// Read-only live check: no account tokens, no data writes.
const config = JSON.parse(await readFile(new URL('../firebase-web-config.json', import.meta.url), 'utf8'))
const app = initializeApp(config, 'anonymous-access-check')
const db = getFirestore(app)
try {
  for (const name of ['users', 'tasks']) {
    await assert.rejects(getDocs(collection(db, name)), error => error.code === 'permission-denied')
    console.log(`PASS: unauthenticated access to ${name} is denied (${config.projectId}).`)
  }
} finally { await terminate(db); await deleteApp(app) }
