# Profile avatars

`profile-avatars.png` is the user-supplied profile reference artwork. `index.js`
defines the eight avatar IDs and exact portrait bounds; the frontend displays
only each portrait inside a circular image viewport. The fox uses the larger
unselected portrait, without the reference's baked-in selection decoration.

The source stays intact and is bundled locally by Vite. Avatar IDs, rather than
asset URLs, are persisted on the user profile. Keep these IDs in sync with the
backend User model and profile route validation when adding choices.
