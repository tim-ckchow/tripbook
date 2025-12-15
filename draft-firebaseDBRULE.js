rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- HELPER FUNCTIONS ---
    function isSignedIn() {
      return request.auth != null;
    }

    // Check if user has a Member Document in the trip
    function hasMemberDoc(tripId) {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/trips/$(tripId)/members/$(request.auth.uid));
    }
    
    // Check if user's email is in the Trip's allowedEmails list
    // This allows access before they have physically "joined" (created a member doc)
    // NOTE: We must check the TRIP document, not the resource (which might be a sub-item)
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
      allow read, write: if isSignedIn() && request.auth.uid == userId;
    }

    match /trips/{tripId} {
      // Create: Allow any signed-in user to create a trip
      allow create: if isSignedIn();

      // Read: Allowed if you are a confirmed member OR if your email is on the list
      allow get: if hasMemberDoc(tripId) || isEmailAllowed(resource.data);
      
      // List: Allow querying if your email is in the allowed list (for TripList query)
      allow list: if isEmailAllowed(resource.data);

      // Write: Generally require being a confirmed member to edit trip details
      allow update: if hasMemberDoc(tripId) || isEmailAllowed(resource.data);
      
      // Delete: Only owner
      allow delete: if hasMemberDoc(tripId) && resource.data.ownerUid == request.auth.uid;

      // --- MEMBERS (Nested Context) ---
      match /members/{memberId} {
        // Members can read the member list.
        allow get, list: if hasMemberDoc(tripId) || isEmailAllowed(get(/databases/$(database)/documents/trips/$(tripId)).data);
        
        // Write: 
        // 1. User can write their OWN member doc (to join)
        // 2. Existing members can write (to update roles/nicknames)
        allow write: if memberId == request.auth.uid || hasMemberDoc(tripId);
      }

      match /schedule/{itemId} {
        // We must fetch the parent trip data to check allowedEmails if the user isn't a member yet
        allow read, write: if hasMemberDoc(tripId) || 
          isEmailAllowed(get(/databases/$(database)/documents/trips/$(tripId)).data);
      }
    }
  }
}