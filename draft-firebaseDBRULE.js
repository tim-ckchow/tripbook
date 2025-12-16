rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- HELPER FUNCTIONS ---
    
    // 1. Check if user is signed in
    // 2. Enforce Google Auth Provider (accounts.google.com or google.com)
    // 3. Ensure email exists
    function isSignedIn() {
      return request.auth != null 
          && request.auth.token.email != null
          //&& (request.auth.token.firebase.sign_in_provider == 'google.com' || request.auth.token.firebase.sign_in_provider == 'accounts.google.com');
          &&isTester();
    }

    // TESTER ALLOWLIST (SIT Stage)
    // Only emails in this list can perform write operations
    function isTester() {
      return request.auth.token.email in ['***@example.com'];
    }

    // Check if user has a Member Document in the trip
    function hasMemberDoc(tripId) {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/trips/$(tripId)/members/$(request.auth.uid));
    }
    
    // Check if user's email is in the Trip's allowedEmails list
    // This allows access before they have physically "joined" (created a member doc)
    function isEmailAllowed(tripData) {
       return isSignedIn() && 
         request.auth.token.email in tripData.allowedEmails;
    }

    // --- GLOBAL RULES ---
    
    match /{path=**}/members/{memberId} {
      allow list: if isSignedIn() && resource.data.uid == request.auth.uid;
    }

    // --- STANDARD COLLECTIONS ---

    match /users/{userId} {
      // Allow read for own profile
      allow read: if isSignedIn() && request.auth.uid == userId;
      // Write restricted to Testers
      allow write: if isSignedIn() && request.auth.uid == userId && isTester();
    }

    match /trips/{tripId} {
      // Create: Allow any signed-in user who is a Tester
      allow create: if isSignedIn() && isTester();

      // Read: Allowed if you are a confirmed member OR if your email is on the list
      allow get: if hasMemberDoc(tripId) || isEmailAllowed(resource.data);
      
      // List: Allow querying if the document's allowedEmails contains the user's email.
      allow list: if isEmailAllowed(resource.data);

      // Write: Generally require being a confirmed member to edit trip details AND be a Tester
      allow update: if (hasMemberDoc(tripId) || isEmailAllowed(resource.data)) && isTester();
      
      // Delete: Only owner AND Tester
      allow delete: if hasMemberDoc(tripId) && resource.data.ownerUid == request.auth.uid && isTester();

      // --- MEMBERS (Nested Context) ---
      match /members/{memberId} {
        // Members can read the member list.
        allow get, list: if hasMemberDoc(tripId) || isEmailAllowed(get(/databases/$(database)/documents/trips/$(tripId)).data);
        
        // Write: Restricted to Testers
        // 1. User can write their OWN member doc (to join)
        // 2. Existing members can write (to update roles/nicknames)
        allow write: if (memberId == request.auth.uid || hasMemberDoc(tripId)) && isTester();
      }

      match /schedule/{itemId} {
        // We must fetch the parent trip data to check allowedEmails if the user isn't a member yet
        allow read: if hasMemberDoc(tripId) || 
          isEmailAllowed(get(/databases/$(database)/documents/trips/$(tripId)).data);

        // Write: Restricted to Testers
        allow write: if (hasMemberDoc(tripId) || 
          isEmailAllowed(get(/databases/$(database)/documents/trips/$(tripId)).data)) && isTester();
      }

      // --- EXPENSES / TRANSACTIONS ---
      match /transactions/{transactionId} {
        allow read: if hasMemberDoc(tripId) || 
          isEmailAllowed(get(/databases/$(database)/documents/trips/$(tripId)).data);

        // Allow write (create, update, delete) for members
        allow write: if (hasMemberDoc(tripId) || 
          isEmailAllowed(get(/databases/$(database)/documents/trips/$(tripId)).data)) && isTester();
      }

      // --- EXPENSE AUDIT LOGS ---
      match /expense_logs/{logId} {
        allow read: if hasMemberDoc(tripId) || 
          isEmailAllowed(get(/databases/$(database)/documents/trips/$(tripId)).data);
        
        // Logs can be created but NOT updated or deleted to preserve audit history
        allow create: if (hasMemberDoc(tripId) || 
          isEmailAllowed(get(/databases/$(database)/documents/trips/$(tripId)).data)) && isTester();
      }
    }
  }
}