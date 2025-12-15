#First vibe code project  

sort of vibe code 80% of the times, but still lot of code review and manually debugging to guide AI into right direction  

this is a trip book app where user can plan trips, add activities, and share with friends.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## deploy to cloudflare pages  
build command: `npm run build`  
publish directory: `dist`

very easy to deploy!
## Environment Variables
Create a `.env.local` file in the root directory and add the following variables:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id
```

and pretty much that's it! (with firebase setup done separately. rules included in the repo)

# Important Note
DO NOT commit your `.env.local` file.
DO NOT commit your `.env.local` file.
DO NOT commit your `.env.local` file.
Keep your API keys private!
