---
title: "Example: Add Birthday Date to Settings Page"
---
Today, we want to display the user's birthday date on our settings page.
1. Display this immediately below the user's name as a label, within the user info card.
2. Pass this to the UI as an ISO timestamp, and format it for display like "January 1, 1970".
3. The design of our backend is complicated, so getting the data will be challenging. Use our $microservices skill to understand the architecture.
    - Retrieve the user's session token from our user info microservices.
    - Use this user session token to read the data from our Raccoon microservice.
    - Make sure that the Omega Star microservice currently supports the ISO timestamps that Galactus requires (like they said they would a month ago).