# ITerview mentor animation artwork

Generated with the built-in imagegen tool from the approved mentor-card mockup and the user's blue fox mascot sheet. No new animation runtime is required.

The consumed asset is `frontend/src/assets/mascot-mentor-atlas.png` (1254 × 1254). Its four parts are isolated at render time with SVG silhouette clips in `MentorMascot.jsx`: head, jacket torso, resting paw, and pointing arm. The wooden pointer is drawn with CSS and turns independently at the wrist. The source raster has a white matte; it does not contain a transparent alpha channel.

The component plays one entrance, an occasional idle head movement, and a nod when the selected rubric changes. Idle movement stops outside the viewport, in a hidden browser tab, and for reduced-motion users. Pointing follows the first line of the related transcript mark, with the stick length bounded to keep it above the question.

## Original atlas generation prompt

Create one square animation sprite atlas for the ITerview blue fox mentor. Use the approved teacher-card mockup for the mentor expression and paws-over-card gesture, and the user's mascot sheet for identity and polished soft 3D shading. Preserve the cobalt-blue chibi fox, dark blue pointed ears with white inner ears, fluffy white cheeks and muzzle, black nose, smiling eyes and mouth, blue zip jacket, and small white chest emblem.

Arrange four separate parts in a 2 × 2 layout: complete head only in the upper left; jacket torso without head, arms, paws, feet or tail in the upper right; one resting blue paw with a short jacket sleeve extending upward in the lower left; one mostly horizontal blue arm extending from a sleeve on the left to a gripping paw on the right in the lower right. Do not draw the card or the pointer. Center each part in its cell with padding, consistent lighting and scale. No labels, borders, text, extra objects or background shadows.

## Final prompt used for the consumed image

Use case: precise-object-edit.
Edit the attached four-part fox sprite sheet. CHANGE ONLY THE BACKGROUND.
Replace EVERY gray checkerboard square with a perfectly solid, uniform PURE WHITE #FFFFFF background.
The image must have a WHITE background. Do NOT make or imitate transparency. Do NOT draw checkerboards. No squares or patterns of any kind.
Keep the four fox parts unchanged in the same square sheet layout: head upper left, blue jacket torso upper right, resting blue paw lower left, pointing blue arm lower right. Preserve all the blue shading and white cheek/chest fur. Sharp clean outlines, no background shadows.
Output one square image with four sprite parts on SOLID WHITE. No labels, no text, no other changes.
