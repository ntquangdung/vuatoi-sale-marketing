import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { ExternalAccountClient, GoogleAuth } from 'google-auth-library'
import { Firestore } from '@google-cloud/firestore'
import { getVercelOidcToken } from '@vercel/oidc'

const cacheKey=Symbol.for('vuatoi.firebaseAdmin.database')
let database=globalThis[cacheKey]
let development
export function setDevelopmentCredentials(client, credential) { development={client,credential} }
export function adminServices() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID || 'vuatoi-mkt'
  if (!getApps().length) {
    let credential
    if (process.env.VERCEL) {
      const number = process.env.GCP_PROJECT_NUMBER || '327588256790'
      const pool = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID || 'vuatoi-vercel'
      const provider = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID || 'production'
      const email = process.env.GCP_SERVICE_ACCOUNT_EMAIL || 'vuatoi-accounts@vuatoi-mkt.iam.gserviceaccount.com'
      const client = ExternalAccountClient.fromJSON({
        type: 'external_account', audience: `//iam.googleapis.com/projects/${number}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`,
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt', token_url: 'https://sts.googleapis.com/v1/token',
        service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${email}:generateAccessToken`,
        subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
      })
      client.scopes = ['https://www.googleapis.com/auth/cloud-platform']
      database = new Firestore({ projectId, auth: new GoogleAuth({ authClient: client, projectId }), preferRest: true })
      credential = { async getAccessToken() { const token = await client.getAccessToken(); if (!token.token) throw new Error('Không lấy được quyền dịch vụ.'); return { access_token: token.token, expires_in: Math.max(60, Math.floor(((client.credentials.expiry_date || Date.now() + 300000) - Date.now()) / 1000)) } } }
    } else if (development) {
      credential=development.credential
      database=new Firestore({projectId,auth:new GoogleAuth({authClient:development.client,projectId}),preferRest:true})
    } else if (process.env.FIREBASE_ADMIN_CREDENTIALS) credential = cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS))
    else credential = applicationDefault()
    initializeApp({ projectId, credential })
    if(database) globalThis[cacheKey]=database
  }
  return { auth: getAuth(), db: database || getFirestore() }
}
