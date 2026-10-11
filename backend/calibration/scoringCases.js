// Fixed original questions and independently authored answer expectations.
// Never ask the scoring model to invent its own expected scores.
// Rows: question, sufficient, partial, incorrect, valid alternative.
// Within each tier: Set 1 clarity/correctness/completeness, then Set 2.
const roles = {
  'it-support': require('./itSupportCases'),
  'data-analyst': require('./dataAnalystCases'),
  'ai-engineer': require('./aiEngineerCases'),
  devops: require('./devopsCases'),
  ios: require('./iosCases'),
  android: require('./androidCases'),
  'ui-ux-developer': require('./uiUxDeveloperCases'),
  'game-developer': require('./gameDeveloperCases'),
  'network-engineer': require('./networkEngineerCases'),
  'cyber-security': require('./cyberSecurityCases'),
  'qa-engineer': {
    easy: [
      ['What is a defect report used for?', 'It communicates an observed problem so someone can reproduce and investigate it.', 'It records something about the application.', 'It automatically repairs the application source code.', 'It documents expected and actual behavior with the conditions needed to repeat the problem.'],
      ['How does an expected result differ from an actual result in a test case?', 'The expected result is what the requirement says should happen; the actual result is what happened during the check.', 'The expected result comes from the requirement.', 'The expected result is observed during the check and the actual result is the requirement.', 'One describes the intended behavior and the other records the behavior the tester observed.'],
      ['Name two useful details in a defect report?', 'The expected behavior and the actual behavior.', 'The actual behavior.', 'The tester favorite movie and favorite meal.', 'The application version and the actions needed to reproduce the problem.'],
      ['A form requires an email input; what should the tester try to check that an empty entry is rejected?', 'Submit with the email blank and observe that it is rejected.', 'Open the form.', 'Submit a valid email and assume this proves empty entries are rejected.', 'Clear an entered email before submitting and confirm the required-input warning.'],
    ],
    medium: [
      ['Why do reproducible conditions make a defect easier to investigate?', 'They let someone repeat the same behavior and inspect what happens under the conditions that triggered it.', 'They give the investigator some information.', 'They guarantee the defect will repair itself without investigation.', 'Keeping the triggering setup and actions clear lets the investigator recreate the failure rather than guess what happened.'],
      ['How does the severity of a defect differ from its priority?', 'Severity describes impact; priority describes how urgently the team plans to address it.', 'Severity describes impact.', 'Severity is the scheduled fix date and priority measures the effect on users.', 'Impact and scheduling urgency are separate, so a minor defect can still be urgent for a demonstration.'],
      ['Name two details needed to reproduce a defect observed in a registration form?', 'The input used and the actions taken before the failure.', 'The input used.', 'The tester favorite movie and the color of their desk.', 'The build version and the starting account state.'],
      ['Name two checks for isolation when two test cases otherwise edit a shared record?', 'Compare the second case alone with running it after the first; verify that each starts with the intended record state.', 'Verify the starting record state.', 'Run both once without observing results; assume a green result proves independence.', 'Compare both execution orders; check that reset fixtures or separate records prevent one case from inheriting changes from the other.'],
    ],
    hard: [
      ['Why does waiting for an observable completion condition make automation more reliable than waiting a fixed amount of time?', 'The check proceeds when the operation actually finishes, so varying response time does not make it read an unfinished result.', 'It helps the check wait.', 'A fixed sleep always guarantees completion, regardless of response time.', 'Readiness-based synchronization ties the assertion to the completed operation instead of guessing its duration.'],
      ['How does an integration check against a real component differ from checking only a test double when response fields change?', 'The real check can detect a changed provider response, while an outdated test double can keep returning the old fields and hide the mismatch.', 'The real check uses the actual component.', 'A test double always automatically detects every real provider change, whereas real integration checks cannot observe response fields.', 'The double verifies behavior against its simulation; exercising the real provider verifies whether its current response still matches the agreed contract.'],
      ['Name three automation safeguards for keeping repeated checks independent and reliable?', 'Separate test data, a known starting state, and waiting for the current observable result.', 'Separate test data and a known starting state.', 'Rerun until green, share changed records, and assume a fixed sleep always guarantees readiness.', 'Isolated fixtures, stable interaction targets, and assertions tied to the current operation.'],
      ['Why would you prefer covering a likely high-impact failure over adding another check for a low-impact behavior already well covered?', 'It addresses a larger uncovered risk and reduces expected harm within the available testing time.', 'It is important.', 'It guarantees that no defect can exist anywhere in the application.', 'The likelihood, consequences, and coverage gap justify spending the next check on that failure.'],
    ],
  },
  frontend: {
    easy: [
      ['What is HTML used for?', 'It structures the content of a webpage.', 'It is part of a webpage.', 'It is the database that stores every user password.', 'It marks up content as headings, paragraphs, links, and other page elements.'],
      ['What is the difference between margin and padding in CSS?', 'Margin is space outside the border; padding is space between the content and border.', 'Margin is outside the border.', 'Margin is inside the border and padding is outside it.', 'Margin separates an element from its neighbors, while padding separates its content from its own border.'],
      ['Name two HTML elements used to display text on a webpage?', 'A heading and a paragraph.', 'A paragraph.', 'A database table and a server process.', 'A span and a list item.'],
      ['What does a click event represent on a webpage?', 'It represents the user activating an element with a click.', 'It is an event.', 'It guarantees a database record has been saved.', 'It signals that a clickable target was activated so the page can respond.'],
    ],
    medium: [
      ['How does a media query adapt a page layout to a smaller screen?', 'It applies CSS rules when the viewport matches a condition, allowing a narrower-screen arrangement.', 'It changes the layout.', 'It changes the physical size of the user monitor.', 'A viewport-width condition enables different styles, such as stacking items when there is less space.'],
      ['How does hiding an element with visibility differ from hiding it with display in a page layout?', 'Visibility hidden keeps its layout space; display none removes it from layout.', 'Visibility hidden keeps space.', 'Visibility hidden removes layout space and display none keeps it.', 'The invisible element still occupies its box with visibility hidden; display none generates no layout box.'],
      ['Name two checks for a CSS class style that does not appear on an element?', 'Check that the class name matches and that a competing rule is not overriding it.', 'Check the class name.', 'Check the user bank balance and change the database password.', 'Verify the stylesheet loads and inspect whether the expected declaration applies in the browser.'],
      ['How does preventing default submission keep a JavaScript form on the current page?', 'It stops the browser native form navigation, letting JavaScript handle the submission without that page reload.', 'It stops something.', 'It disables every possible network request permanently.', 'Cancelling the default submit action prevents automatic navigation while a custom handler processes the form.'],
    ],
    hard: [
      ['How does server rendering make initial page content available before the browser finishes running the application scripts?', 'The server sends HTML containing the content, so the browser can display it before client scripts build the page.', 'The server helps the page.', 'The browser must finish all application scripts before any server-rendered content can appear.', 'The response already includes rendered markup instead of requiring JavaScript to construct the initial content.'],
      ['How does server rendering differ from client rendering in making initial page content available before application scripts run?', 'Server rendering includes initial content in the HTML response; client rendering relies on browser scripts to construct it.', 'Server rendering includes initial HTML.', 'Client rendering always supplies complete initial content without scripts and server rendering can never supply HTML.', 'A server-rendered response can display its content as HTML arrives, while a client-rendered view waits for the code that creates that content.'],
      ['Name three checks for an expensive component that redraws although its displayed data is unchanged?', 'Check changing parent renders, unstable object props, and context updates.', 'Check parent renders and unstable object props.', 'Change the database password, delete the stylesheet, and disable all user input.', 'Inspect state updates, changing callback identities, and whether memoization dependencies remain stable.'],
      ['How does a long chain of promise microtasks delay the browser from responding to user input?', 'The browser drains microtasks before proceeding to later tasks and rendering opportunities, so a chain can postpone queued input handling.', 'The chain makes the browser busy.', 'Every microtask interrupts its work to guarantee immediate processing of every user input.', 'Repeated microtasks can keep the current checkpoint busy and prevent the event loop from reaching the task that handles the input promptly.'],
    ],
  },
  backend: {
    easy: [
      ['What does a server do?', 'It receives client requests, processes them, and returns responses.', 'It is a computer.', 'It is the CSS rule that colors a webpage.', 'It provides data or services requested by clients.'],
      ['What is the difference between a GET request and a POST request?', 'GET requests retrieve information; POST requests submit information for processing.', 'GET retrieves information.', 'GET submits information and POST can only retrieve it.', 'GET asks for a resource, while POST sends data for a resource to process.'],
      ['Name two database operations that change stored records?', 'Update and delete.', 'Update.', 'Read and retrieve.', 'Create and update.'],
      ['What does an API let two applications do?', 'It lets them exchange information or request services through a defined interface.', 'It connects things.', 'It guarantees that both applications share the same physical computer.', 'One application can request data or behavior that another application exposes.'],
    ],
    medium: [
      ['How does a route parameter identify the student record requested from an API?', 'The parameter supplies the student identifier in the path, which the handler uses to look up that record.', 'It helps find a student.', 'It automatically selects the last student regardless of the requested identifier.', 'The route captures the identifier from the requested URL and uses it to choose the matching student.'],
      ['How does a path parameter differ from a query parameter when requesting records?', 'A path parameter is part of the route path and often identifies a record; a query parameter follows the query delimiter and can filter the request.', 'A path parameter is in the path.', 'Path parameters are stored only in the request body and query parameters are the server source code.', 'The path value fills a route segment, while query values supply additional options such as filtering or pagination.'],
      ['Name two request details to check when matching a request to a defined route?', 'The HTTP method and the URL path.', 'The URL path.', 'The display resolution and the page font.', 'The requested path and whether the request uses the method defined for that route.'],
      ['How does middleware let a server validate input before its route handler runs?', 'It runs earlier in the request pipeline and can reject invalid input or pass a validated request to the handler.', 'It checks input.', 'It always runs only after the response is sent and cannot stop an invalid request.', 'A validation stage examines the request before the route action and forwards it only when its checks pass.'],
    ],
    hard: [
      ['How does an atomic database transaction protect a transfer when the debit succeeds but the matching credit fails?', 'It rolls back the debit when the credit fails, so the transfer does not leave only one side committed.', 'It makes the transfer safer.', 'It keeps the debit committed and silently ignores the failed credit.', 'Both changes succeed together or neither is committed, preserving the balance relationship if the second write errors.'],
      ['How does optimistic version checking differ from pessimistic locking when two requests edit the same database record?', 'Optimistic checking rejects a write based on a stale version; pessimistic locking coordinates access by holding a lock so conflicting edits wait.', 'Optimistic checking compares versions.', 'Optimistic checking always locks every reader and pessimistic locking never coordinates access.', 'One detects a conflict at save time using the version; the other prevents overlapping conflicting work by acquiring a lock.'],
      ['Name three test cases for an endpoint that uses version checks to prevent conflicting record edits?', 'A current-version edit succeeds, a stale-version edit is rejected, and two competing edits from the same version do not both overwrite each other.', 'A current-version edit succeeds and a stale-version edit is rejected.', 'Every stale write succeeds, both conflicting edits always overwrite freely, and version values are ignored.', 'Verify a successful write advances the version, an obsolete version cannot replace current data, and concurrent same-version submissions leave only one accepted edit.'],
      ['How does an atomic database transaction protect a transfer when the debit succeeds but the matching credit encounters an error?', 'The failed credit causes the transaction to roll back the debit, preventing a partially committed transfer.', 'It protects money.', 'The debit stays committed even though the credit fails because atomicity permits half a transfer.', 'The pair of changes commits as a unit; on failure, neither side remains committed.'],
    ],
  },
  fullstack: {
    easy: [
      ['What does the frontend do in a web application?', 'It displays the interface and handles user interactions.', 'It is part of the application.', 'It is the private database server storing all records.', 'It presents content and controls that people interact with in the browser.'],
      ['What is the difference between the frontend and the backend?', 'The frontend presents the user interface; the backend handles server-side processing and data access.', 'The frontend shows the interface.', 'The frontend is always the private database and the backend is only the page color.', 'Browser-facing interaction belongs to the frontend, while requests and protected processing happen on the backend.'],
      ['Name two main parts of a web application?', 'The frontend and the backend.', 'The frontend.', 'The monitor stand and the office chair.', 'The backend and the database.'],
      ['What does saving information in a database allow an application to do later?', 'Retrieve the stored information later.', 'Use information.', 'Guarantee the information disappears as soon as it is saved.', 'Read the saved records again when the application needs them.'],
    ],
    medium: [
      ['How does a server response help the frontend show the outcome of a form submission?', 'The response tells the frontend whether the submission succeeded or was rejected, so it can display the corresponding message.', 'It sends information.', 'It changes the browser hardware so the frontend no longer needs to inspect any result.', 'The page reads the returned status or result and updates its feedback to reflect what the server accepted.'],
      ['How does local storage differ from session storage when a browser tab is closed?', 'Local storage normally persists after the tab closes; session storage belongs to the tab session and is cleared when that session ends.', 'Local storage normally persists.', 'Local storage always clears on tab close while session storage persists forever.', 'A normal reopened session can still read local storage, whereas data tied to the closed tab session is not normally retained.'],
      ['Name two field details the frontend and backend must agree on for a form submission?', 'The field name and the expected data type.', 'The field name.', 'The office address and the monitor brand.', 'Whether the field is required and its permitted format.'],
      ['How does parsing JSON text make returned fields available to the frontend?', 'It converts JSON text into a data value whose fields the page can access.', 'It handles text.', 'It automatically writes every received field to the database and prevents any parsing error.', 'The text is decoded into structured data so the interface can read the returned values.'],
    ],
    hard: [
      ['Why must the server check an active session before accepting a save even when the browser still displays a logged-in screen?', 'The screen can be stale; only the server check confirms the session is still valid when the save is requested.', 'It is for security.', 'A logged-in screen guarantees the session can never expire, so no check is needed.', 'Client-side display does not establish current authentication, so the server validates the session before authorizing the save.'],
      ['How does an expired session differ from an active session without record permission in the server reason for rejecting a save?', 'An expired session lacks current authentication; an active session without permission is authenticated but not authorized for that record.', 'An expired session is no longer authenticated.', 'An expired session proves authorization, while a lack of record permission means the user is definitely not signed in.', 'The first requires renewed authentication; the second still identifies the user but denies access to the requested record.'],
      ['Name three test cases for preserving an unsaved form when its session expires during submission?', 'Verify rejected submission retains typed values, renewing authentication does not erase them, and retrying after renewal saves the retained values.', 'Verify rejected submission retains typed values and authentication renewal does not erase them.', 'Discard the form on rejection, erase it on renewal, and show saved success without a confirmed write.', 'Check an expiry rejection preserves draft text, a failed renewal keeps the draft available, and cancellation of sign-in leaves the unsaved form intact.'],
      ['How does checking record ownership on the server protect data when a user bypasses a hidden edit button?', 'The server rejects changes to records the user does not own even if they send the request directly.', 'It checks the user.', 'Hiding the button guarantees the server never needs to check any request.', 'Authorization on each write prevents a manipulated browser or direct request from editing another user record.'],
    ],
  },
};

const dimensions = {
  set1: ['clarity_score', 'correctness_score', 'completeness_score'],
  set2: ['problem_solving_score', 'accuracy_score', 'depth_score'],
};
const kinds = ['correct', 'partial', 'incorrect', 'alternative'];

function getScoringCases() {
  return Object.entries(roles).flatMap(([role, tiers]) => Object.entries(tiers).flatMap(([difficulty, rows]) =>
    rows.map(([question, ...answers], index) => {
      const set = index === 3 ? 'set2' : 'set1';
      const focus = ['focus_clarity', 'focus_correctness', 'focus_completeness'][index] || null;
      return { id: `${role}.${difficulty}.${set}.${focus || 'technical'}`, role, difficulty, set, focus, question,
        answers: answers.map((answer, answerIndex) => {
          const kind = kinds[answerIndex];
          const expected = kind === 'correct' || kind === 'alternative'
            ? Object.fromEntries(dimensions[set].map(key => [key, [4, 5]]))
            : kind === 'incorrect' ? { [set === 'set1' ? 'correctness_score' : 'accuracy_score']: [1, 2] }
              : { [set === 'set1' ? 'completeness_score' : 'depth_score']: [1, 3] };
          if (kind === 'partial' && set === 'set1' && focus === 'focus_completeness') expected.correctness_score = [4, 5];
          return { kind, answer, expected };
        }) };
    })));
}

module.exports = { getScoringCases, dimensions, kinds };
