# Manual Test Checklist: Edit Task Functionality

## 1. Adding a New Task (Regression Check)

*   **Test Case 1.1:** Verify "Add New Task" modal opens correctly.
    *   **Steps:**
        1.  Click the "+" button in any column (e.g., "Backlog").
    *   **Expected Result:** The modal opens with the title "Add New Task" and the save button text "Save Task". Input fields (name, description, due date) are empty.
*   **Test Case 1.2:** Verify a new task can be added with a name, description, and due date.
    *   **Steps:**
        1.  Open the "Add New Task" modal.
        2.  Enter a unique task name (e.g., "Test Add Task Name").
        3.  Enter a task description (e.g., "Test Add Task Description").
        4.  Select a due date (e.g., tomorrow).
        5.  Click "Save Task".
    *   **Expected Result:** The modal closes. A new task card appears in the target column with the entered name, description (visible when details expanded), and due date.
*   **Test Case 1.3:** Verify the new task appears in the correct column.
    *   **Steps:**
        1.  Add a new task via the "Todo" column's "+" button.
    *   **Expected Result:** The new task card appears in the "Todo" column.

## 2. Editing an Existing Task

*   **Test Case 2.1:** Verify "Edit Task" modal opens correctly.
    *   **Steps:**
        1.  Ensure a task exists.
        2.  Hover over the task card.
        3.  Click the "Edit" (pencil) icon.
    *   **Expected Result:** The modal opens with the title "Edit Task" and the save button text "Update Task".
*   **Test Case 2.2:** Verify modal is populated with correct task data.
    *   **Steps:**
        1.  Create a task with a specific name (e.g., "Edit Test Original Name"), description (e.g., "Edit Test Original Description"), and due date (e.g., next week).
        2.  Click the "Edit" icon on this task.
    *   **Expected Result:** The modal's name field contains "Edit Test Original Name", description field contains "Edit Test Original Description", and due date field shows the correct date.
*   **Test Case 2.3:** Change task name and save.
    *   **Steps:**
        1.  Open a task for editing.
        2.  Change the task name (e.g., to "Edit Test Updated Name").
        3.  Click "Update Task".
    *   **Expected Result:** Modal closes. The task card on the board displays "Edit Test Updated Name".
*   **Test Case 2.4:** Change task description and save.
    *   **Steps:**
        1.  Open a task for editing.
        2.  Change the task description (e.g., to "Edit Test Updated Description").
        3.  Click "Update Task".
        4.  Expand the task details on the card.
    *   **Expected Result:** Modal closes. The task's description in the details view shows "Edit Test Updated Description".
*   **Test Case 2.5.1:** Change task due date (set if not set).
    *   **Steps:**
        1.  Create a task with no due date.
        2.  Open the task for editing.
        3.  Set a due date (e.g., today).
        4.  Click "Update Task".
        5.  Expand task details.
    *   **Expected Result:** Modal closes. The task's due date is updated and displayed correctly.
*   **Test Case 2.5.2:** Change task due date (change if set).
    *   **Steps:**
        1.  Create a task with a due date (e.g., today).
        2.  Open the task for editing.
        3.  Change the due date to a different date (e.g., tomorrow).
        4.  Click "Update Task".
        5.  Expand task details.
    *   **Expected Result:** Modal closes. The task's due date is updated to tomorrow.
*   **Test Case 2.5.3:** Change task due date (clear if set).
    *   **Steps:**
        1.  Create a task with a due date.
        2.  Open the task for editing.
        3.  Clear the due date field.
        4.  Click "Update Task".
        5.  Expand task details.
    *   **Expected Result:** Modal closes. The task's due date shows "Not set" or similar.
*   **Test Case 2.6:** Verify modal resets after saving an edit.
    *   **Steps:**
        1.  Edit a task and click "Update Task".
        2.  The modal closes.
        3.  Click the "+" button in any column to open the "Add New Task" modal.
    *   **Expected Result:** The modal opens with the title "Add New Task", button "Save Task", and empty input fields.

## 3. Modal Behavior

*   **Test Case 3.1:** Open task for editing, then cancel/close.
    *   **Steps:**
        1.  Note the current name, description, and due date of a task.
        2.  Open the task for editing.
        3.  Change the values in the input fields but DO NOT save.
        4.  Click the "Cancel" button (or "X" or click outside modal).
        5.  Observe the task card and its details.
    *   **Expected Result:** The modal closes. The task's name, description, and due date remain unchanged from their original values.
*   **Test Case 3.2:** Modal resets to "Add New Task" mode.
    *   **Steps:**
        1.  Open a task for editing.
        2.  Close the modal (e.g., click "Cancel").
        3.  Click a column's "+" button.
    *   **Expected Result:** The modal opens with title "Add New Task", button "Save Task", and empty/default input fields. The `data-editing-task-id` attribute should be removed from the save button.

## 4. Interaction with Other Controls (Regression Checks)

*   **Test Case 4.1:** Duplicate Task.
    *   **Steps:**
        1.  Hover over a task card.
        2.  Click the "Duplicate Task" (copy) icon.
    *   **Expected Result:** A copy of the task (e.g., "Task Name (Copy)") appears below the original task, with identical description, due date, and subtasks (subtasks should have new IDs). The edit functionality should not interfere.
*   **Test Case 4.2:** Delete Task.
    *   **Steps:**
        1.  Hover over a task card.
        2.  Click the "Delete Task" (trash) icon.
        3.  Confirm deletion.
    *   **Expected Result:** The task is removed from the board. The edit functionality should not interfere.
*   **Test Case 4.3:** Mark as Important.
    *   **Steps:**
        1.  Hover over a task card.
        2.  Click the "Mark as Important" (star) icon.
    *   **Expected Result:** The star icon toggles its state (filled/unfilled), and the task's importance is updated. The edit functionality should not interfere.
*   **Test Case 4.4.1:** Subtask - Add.
    *   **Steps:**
        1.  Expand details for a task.
        2.  Type subtask text into the "Add subtask..." input and press Enter.
    *   **Expected Result:** New subtask is added to the task.
*   **Test Case 4.4.2:** Subtask - Complete.
    *   **Steps:**
        1.  Click the checkbox next to a subtask.
    *   **Expected Result:** Subtask completion status toggles.
*   **Test Case 4.4.3:** Subtask - Delete.
    *   **Steps:**
        1.  Hover over a subtask.
        2.  Click the delete (trash) icon for the subtask. Confirm.
    *   **Expected Result:** Subtask is removed.
*   **Test Case 4.4.4:** Subtask - Convert to Task.
    *   **Steps:**
        1.  Hover over a subtask.
        2.  Click the convert (level-up) icon for the subtask. Confirm.
    *   **Expected Result:** Subtask is removed, and a new task is created in the "Backlog" with the subtask's text as its name.
*   **Test Case 4.4.5:** Subtask - Duplicate.
    *   **Steps:**
        1.  Hover over a subtask.
        2.  Click the duplicate (copy) icon for the subtask.
    *   **Expected Result:** A copy of the subtask appears below the original.
*   **Test Case 4.5:** Inline edit task name.
    *   **Steps:**
        1.  Double-click on a task's name on the card.
        2.  Edit the name and press Enter or click away.
    *   **Expected Result:** Task name is updated on the card.
*   **Test Case 4.6:** Inline edit task description.
    *   **Steps:**
        1.  Expand task details.
        2.  Double-click on the task's description.
        3.  Edit the description and press Enter or click away.
    *   **Expected Result:** Task description is updated in the details view.
*   **Test Case 4.7:** Inline edit due date.
    *   **Steps:**
        1.  Expand task details.
        2.  Click the calendar icon next to the due date.
        3.  Select a new date.
    *   **Expected Result:** Task due date is updated.

## 5. Undo/Redo for Edits

*   **Test Case 5.1.1:** Undo/Redo task name edit.
    *   **Steps:**
        1.  Edit a task's name via the "Edit Task" modal and save (e.g., "Name A" to "Name B").
        2.  Click the "Undo" button.
        3.  Observe the task name on the card.
        4.  Click the "Redo" button.
        5.  Observe the task name on the card.
    *   **Expected Result:** After Undo, name reverts to "Name A". After Redo, name changes back to "Name B".
*   **Test Case 5.1.2:** Undo/Redo task description edit.
    *   **Steps:**
        1.  Edit a task's description via the "Edit Task" modal and save (e.g., "Desc A" to "Desc B").
        2.  Click "Undo". Expand details.
        3.  Click "Redo". Expand details.
    *   **Expected Result:** After Undo, description reverts to "Desc A". After Redo, description changes back to "Desc B".
*   **Test Case 5.1.3:** Undo/Redo task due date edit.
    *   **Steps:**
        1.  Edit a task's due date via the "Edit Task" modal and save (e.g., Date A to Date B).
        2.  Click "Undo". Expand details.
        3.  Click "Redo". Expand details.
    *   **Expected Result:** After Undo, due date reverts to Date A. After Redo, due date changes back to Date B.
*   **Test Case 5.2:** Undo/Redo adding a new task.
    *   **Steps:**
        1.  Add a new task.
        2.  Click "Undo".
        3.  Click "Redo".
    *   **Expected Result:** After Undo, the new task is removed. After Redo, the new task reappears.
*   **Test Case 5.3:** Undo/Redo deleting a task.
    *   **Steps:**
        1.  Delete an existing task.
        2.  Click "Undo".
        3.  Click "Redo".
    *   **Expected Result:** After Undo, the task is restored. After Redo, the task is deleted again.

## 6. Edge Cases

*   **Test Case 6.1:** Edit task, attempt to save with empty name.
    *   **Steps:**
        1.  Open an existing task for editing.
        2.  Clear the task name field.
        3.  Click "Update Task".
    *   **Expected Result:** An error message appears in the modal (e.g., "Please enter a task name."). The modal remains open, and the task is not saved with an empty name. The original name should still be in the task data.
*   **Test Case 6.2:** Edit task in one project, then switch project.
    *   **Steps:**
        1.  Have at least two projects (e.g., Project A, Project B).
        2.  In Project A, open a task for editing. Make some changes in the modal fields but DO NOT SAVE.
        3.  While the modal is still open, switch to Project B using the sidebar.
        4.  Switch back to Project A.
        5.  Observe the task that was being edited.
        6.  Open the "Add Task" modal in Project A.
    *   **Expected Result:**
        *   When switching projects, the edit modal should ideally close (or its changes be discarded).
        *   The task in Project A should remain unchanged (as no save occurred).
        *   The "Add Task" modal in Project A should open in "Add New Task" mode, not retain any state from the previous edit attempt. (This depends on `closeTaskModal` being robustly called or state being cleared on project switch).

This checklist provides a good starting point for testing. Specific implementation details might necessitate additional tests.The checklist for manual testing has been created and saved to `manual_tests/edit_task_checklist.md`.
This comprehensive checklist covers:
1.  Adding new tasks (regression).
2.  Editing existing tasks (name, description, due date).
3.  Modal behavior (opening, closing, canceling, resetting).
4.  Interactions with other task controls (duplicate, delete, important, subtasks, inline edits).
5.  Undo/Redo functionality for edits, additions, and deletions.
6.  Edge cases like saving with an empty name and switching projects during an edit.

This will be useful for manually verifying the implemented features and ensuring no regressions have occurred.
