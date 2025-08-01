// --- DOM Elements ---
const columns = document.querySelectorAll('.kanban-column');
const projectListElement = document.getElementById('project-list');
const boardTitleElement = document.getElementById('board-title');
const addTaskModal = document.getElementById('add-task-modal');
const closeTaskModalButton = document.getElementById('modal-close-task-button');
const cancelTaskModalButton = document.getElementById('modal-cancel-task-button');
const saveTaskButton = document.getElementById('modal-save-task-button');
const modalTaskNameInput = document.getElementById('modal-task-name-input');
const modalTaskDescInput = document.getElementById('modal-task-desc-input');
const modalTaskDueDateInput = document.getElementById('modal-task-due-date-input');
const modalAddTaskError = document.getElementById('modal-add-task-error');
const addProjectButtonSidebar = document.getElementById('add-project-button-sidebar');
const addProjectModal = document.getElementById('add-project-modal');
const closeProjectModalButton = document.getElementById('modal-close-project-button');
const cancelProjectModalButton = document.getElementById('modal-cancel-project-button');
const saveProjectButton = document.getElementById('modal-save-project-button');
const modalProjectNameInput = document.getElementById('modal-project-name-input');
const modalAddProjectError = document.getElementById('modal-add-project-error');
const openSettingsButton = document.getElementById('open-settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsModalButton = document.getElementById('modal-close-settings-button');
const doneSettingsModalButton = document.getElementById('modal-done-settings-button');
const exportDataButtonModal = document.getElementById('export-data-button-modal');
const importDataButtonModal = document.getElementById('import-data-button-modal');
const addTaskColumnButtons = document.querySelectorAll('.add-task-column-button');
const importFileInput = document.getElementById('import-file-input');
const confirmationModal = document.getElementById('confirmation-modal');
const confirmationMessage = document.getElementById('confirmation-message');
const confirmYesButton = document.getElementById('confirm-yes-button');
const confirmNoButton = document.getElementById('confirm-no-button');
const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const maxUndoStepsInput = document.getElementById('max-undo-steps-input');

// --- State ---
let projectsData = {};
let currentProjectName = '';
let activeInlineEditInput = null;
let activeInlineDateInput = null;
let targetStatusForTaskAdd = 'backlog';
let confirmationCallback = null;

// --- Undo/Redo State ---
let historyStack = []; // Stores past states for undo
let redoStack = []; // Stores undone states for redo
const DEFAULT_MAX_UNDO_STEPS = 10;
let maxUndoSteps = DEFAULT_MAX_UNDO_STEPS;
const UNDO_STORAGE_KEY = 'kanbanUndoMaxSteps'; // Key for storing max steps

// --- Constants ---
const DATA_TYPE = 'text/type'; // Mime type for drag type (task or subtask)
const TASK_ID = 'text/taskId'; // Mime type for task ID
const SUBTASK_ID = 'text/subtaskId'; // Mime type for subtask ID
const SOURCE_TASK_ID = 'text/sourceTaskId'; // Mime type for the parent task ID when dragging a subtask
const DRAG_TYPE_TASK = 'task';
const DRAG_TYPE_SUBTASK = 'subtask';
const LOCAL_STORAGE_KEY = 'kanbanProjectsData-v1'; // Key for storing data in localStorage
const ALL_PROJECTS_VIEW_KEY = '--all-important--'; // Special key for the "All Important Tasks" view
const ALL_PROJECTS_VIEW_TITLE = 'All Important Tasks';
const DEFAULT_PROJECT_NAME = "Default Project"; // Name for the initial default project
const VALID_STATUSES = ['backlog', 'todo', 'inprogress', 'done']; // Allowed task statuses
const DRAG_TYPE_PROJECT_SIDEBAR = 'projectSidebarItem'; // Mime type for project sidebar items

// --- Helper to generate unique IDs ---
function generateUniqueId() {
    // Use a combination of timestamp and random number for uniqueness
     return Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

// --- Undo/Redo Functions ---

/**
 * Deep clones the current projectsData state.
 * Uses JSON parsing for simplicity, assuming data is JSON serializable.
 * @returns {object} A deep copy of projectsData.
 */
function cloneState() {
    try {
        return JSON.parse(JSON.stringify(projectsData));
    } catch (error) {
        console.error("Error cloning state:", error);
        // Return an empty state as a fallback to prevent crashing
        return { currentProject: DEFAULT_PROJECT_NAME, projects: {}, projectOrder: [] };
    }
}

/**
 * Saves the current state to the history stack for undo functionality.
 * Clears the redo stack and enforces the maxUndoSteps limit.
 */
function saveStateForUndo() {
    // Clear the redo stack whenever a new action is performed
    redoStack = [];

    // Push a deep copy of the *current* state onto the history stack
    historyStack.push(cloneState());

    // Enforce the maximum undo steps limit
    if (historyStack.length > maxUndoSteps) {
        historyStack.shift(); // Remove the oldest state (from the beginning)
    }

    // Update button states
    updateUndoRedoButtonStates();
    // console.log("State saved for undo. History:", historyStack.length, "Redo:", redoStack.length); // Debug log
}

/**
 * Restores the previous state from the history stack.
 */
function undoLastAction() {
    if (historyStack.length === 0) {
        console.log("Undo stack empty.");
        return; // Nothing to undo
    }

    // Push the *current* state (before undoing) onto the redo stack
    // Check max steps *before* pushing to prevent exceeding limit temporarily
     if (historyStack.length >= maxUndoSteps) {
         historyStack.shift(); // Make space if already full
     }
    redoStack.push(cloneState());

    // Pop the last state from history to restore it
    const previousState = historyStack.pop();

    // Restore the projectsData
    projectsData = previousState;
    currentProjectName = projectsData.currentProject; // Ensure currentProjectName is also restored

    // Refresh the entire UI based on the restored state
    updateUIFromState(false); // Pass false to prevent saving undo state during undo itself

    // Update button states
    updateUndoRedoButtonStates();
    // console.log("Undo performed. History:", historyStack.length, "Redo:", redoStack.length); // Debug log
}

/**
 * Re-applies an undone action from the redo stack.
 */
function redoLastAction() {
    if (redoStack.length === 0) {
        console.log("Redo stack empty.");
        return; // Nothing to redo
    }

    // Push the *current* state (before redoing) back onto the history stack
    // Check max steps *before* pushing to prevent exceeding limit temporarily
     if (historyStack.length >= maxUndoSteps) {
         historyStack.shift(); // Make space if already full
     }
    historyStack.push(cloneState());

    // Pop the state to redo
    const nextState = redoStack.pop();

    // Restore the projectsData
    projectsData = nextState;
    currentProjectName = projectsData.currentProject; // Restore project name

    // Refresh the entire UI
    updateUIFromState(false); // Pass false to prevent saving undo state during redo

    // Update button states
    updateUndoRedoButtonStates();
    // console.log("Redo performed. History:", historyStack.length, "Redo:", redoStack.length); // Debug log
}

/**
 * Clears both the undo and redo history stacks.
 * Typically used after importing data or potentially on initialization.
 */
function clearUndoHistory() {
    historyStack = [];
    redoStack = [];
    updateUndoRedoButtonStates();
    // console.log("Undo/Redo history cleared."); // Debug log
}

/**
 * Updates the enabled/disabled state of the Undo and Redo buttons.
 */
function updateUndoRedoButtonStates() {
    undoButton.disabled = historyStack.length === 0;
    redoButton.disabled = redoStack.length === 0;
}

/**
 * Refreshes the UI components based on the current projectsData state.
 * @param {boolean} [saveForUndo=true] - Whether to save the state *before* this update for undo.
 *                                      Set to false when called from undo/redo itself.
 */
function updateUIFromState(saveForUndo = true) {
    // Save state *before* the action that leads to this UI update.
    // This function primarily handles rendering the current state.
    // The 'saveForUndo' flag here is mainly relevant if an action *directly* calls this
    // function to update UI *and* needs to save state *just before* that update.
    // Typically, state saving happens before the data *mutation*.
    if (saveForUndo) {
         // It's generally better to call saveStateForUndo() right before the data modification.
         // This check is mainly here as a failsafe if the save pattern was inconsistent.
         // console.warn("updateUIFromState called with saveForUndo=true. Consider calling saveStateForUndo() *before* modifying data instead.");
         // saveStateForUndo(); // Uncomment if this function is the only place saving state for some actions
    }

    // Update the UI elements based on the current `projectsData`
    populateProjectList();
    updateBoardTitle();
    checkAndMarkOverdueTasks(); // Re-check overdue status based on current state
    renderTasks(); // Re-render tasks based on current state
    updateUndoRedoButtonStates(); // Ensure buttons reflect current history state

    // Clean up any lingering drag-over styles
     document.querySelectorAll('.drag-over-item-top, .drag-over-item-bottom, .kanban-column.drag-over, .project-list-item.drag-over-indicator, .project-list-item.drag-over-indicator-bottom').forEach(el => {
         el.classList.remove('drag-over-item-top', 'drag-over-item-bottom', 'drag-over', 'drag-over-indicator', 'drag-over-indicator-bottom');
     });
     document.querySelectorAll('.dragging, .subtask-dragging, .sidebar-dragging').forEach(el => {
         el.classList.remove('dragging', 'subtask-dragging', 'sidebar-dragging');
     });
}


// --- Core Functions ---
/**
 * Updates the main board title based on the current view (specific project or "All Important").
 */
function updateBoardTitle() {
    if (boardTitleElement) {
        if (currentProjectName === ALL_PROJECTS_VIEW_KEY) {
            boardTitleElement.textContent = ALL_PROJECTS_VIEW_TITLE;
            boardTitleElement.classList.remove('cursor-text'); // Not editable
            boardTitleElement.removeAttribute('title');
        } else {
            boardTitleElement.textContent = currentProjectName || "Kanban Board";
            boardTitleElement.classList.add('cursor-text'); // Editable
            boardTitleElement.title = "Double-click to rename project";
        }
    }
}

/**
 * Saves the current projectsData object to localStorage.
 */
function saveProjectsData() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projectsData));
    } catch (error) {
        console.error("Error saving data:", error);
        // Optionally show an error to the user
    }
}

 /**
  * Validates and cleans up project data structure upon loading.
  * Adds missing properties like projectOrder, isArchived, isPinned, task IDs, subtask IDs, etc.
  * Ensures data integrity.
  * @param {object} data - The parsed data object from localStorage.
  * @returns {object} The validated and potentially cleaned data object.
  */
 function validateAndCleanDataStructure(data) {
    // Ensure basic structure exists
    if (!data || typeof data !== 'object') {
        console.warn("Stored data is invalid or missing. Initializing defaults.");
        return null; // Signal to initialize defaults
    }

    // Ensure projects object exists and is valid
    if (!data.projects || typeof data.projects !== 'object') {
        console.warn("Invalid 'projects' structure. Initializing empty projects object.");
        data.projects = {};
    }

     // Ensure projectOrder array exists and is valid
     if (!Array.isArray(data.projectOrder)) {
         console.warn("Invalid or missing 'projectOrder' array. Rebuilding from project keys.");
         data.projectOrder = Object.keys(data.projects); // Start with keys
     } else {
        // Clean projectOrder: remove keys that don't exist in projectsData.projects
         const projectKeys = Object.keys(data.projects);
         data.projectOrder = data.projectOrder.filter(key => projectKeys.includes(key));
         // Add any keys that exist in projects but are missing from projectOrder (append to end)
         projectKeys.forEach(key => {
            if (!data.projectOrder.includes(key)) {
                data.projectOrder.push(key);
            }
         });
     }


    // Validate and clean each project
    for (const projectName in data.projects) {
        const projectData = data.projects[projectName];

         // Ensure project is an object (migrate old array format)
         if (Array.isArray(projectData)) {
             console.warn(`Migrating old project structure for "${projectName}"`);
             const oldTasks = projectData;
             data.projects[projectName] = { tasks: [], isArchived: false, isPinned: false }; // Create new structure
             data.projects[projectName].tasks = oldTasks; // Move tasks to the new tasks property
         } else if (typeof projectData !== 'object' || projectData === null) {
             console.warn(`Invalid data for project "${projectName}". Resetting.`);
             data.projects[projectName] = { tasks: [], isArchived: false, isPinned: false };
         }

        const cleanedProject = data.projects[projectName];

        // Ensure project properties exist
        cleanedProject.isArchived = typeof cleanedProject.isArchived === 'boolean' ? cleanedProject.isArchived : false;
         cleanedProject.isPinned = typeof cleanedProject.isPinned === 'boolean' ? cleanedProject.isPinned : false;
        cleanedProject.tasks = Array.isArray(cleanedProject.tasks) ? cleanedProject.tasks : [];

        // Validate and clean each task within the project
        cleanedProject.tasks = cleanedProject.tasks.map(task => {
            // --- Robust Task Validation ---
            // Ensure task is an object first, otherwise discard
            if (typeof task !== 'object' || task === null) {
                console.warn(`Skipping invalid task entry in project "${projectName}":`, task);
                return null; // Mark for filtering out
            }

            // Assign ID if missing *before* further processing
            task.id = task.id || generateUniqueId();

            // Ensure other basic properties exist and have correct types/defaults
            task.name = task.name || 'Untitled Task';
            task.description = task.description || '';
            task.status = VALID_STATUSES.includes(task.status) ? task.status : 'backlog';
            task.isImportant = typeof task.isImportant === 'boolean' ? task.isImportant : false;
            task.dueDate = task.dueDate || null; // Ensure null if empty/missing

            // Validate subtasks array - ensure it's an array, filter invalid subtask entries
            task.subtasks = Array.isArray(task.subtasks) ? task.subtasks.map(subtask => {
                 // --- Robust Subtask Validation ---
                 // Ensure subtask is an object first, otherwise discard
                 if (typeof subtask !== 'object' || subtask === null) {
                     console.warn(`Skipping invalid subtask entry in task ${task.id} (${task.name}):`, subtask);
                     return null; // Mark for filtering out
                 }
                 // Assign ID if missing *before* further processing
                 subtask.id = subtask.id || generateUniqueId();
                 // Ensure other properties exist
                 subtask.text = subtask.text || 'Untitled Subtask';
                 subtask.completed = typeof subtask.completed === 'boolean' ? subtask.completed : false;
                 return subtask; // Return the cleaned subtask
            }).filter(subtask => subtask !== null) // Filter out any null entries from subtask mapping
            : []; // Default to empty array if task.subtasks was not an array

            return task; // Return the cleaned task
        }).filter(task => task !== null); // Filter out any null entries from task mapping

    } // End project validation loop

     // Ensure current project selection is valid
    if (!data.currentProject || (data.currentProject !== ALL_PROJECTS_VIEW_KEY && !data.projects[data.currentProject])) {
        // Find the first non-archived, non-pinned project in the order, or the first pinned, or default/all important
        const orderedProjects = data.projectOrder
            .filter(name => data.projects[name] && !data.projects[name].isArchived); // Get only valid, non-archived projects from order

         const firstUnpinned = orderedProjects.find(name => !data.projects[name]?.isPinned);
         const firstPinned = orderedProjects.find(name => data.projects[name]?.isPinned);

         data.currentProject = firstUnpinned || firstPinned || ALL_PROJECTS_VIEW_KEY;

         // If still no valid project, and there are projects, default to the first one found
         if (data.currentProject !== ALL_PROJECTS_VIEW_KEY && !data.projects[data.currentProject]) {
             const anyProject = Object.keys(data.projects).filter(name => data.projects[name] && !data.projects[name]?.isArchived)[0];
              data.currentProject = anyProject || DEFAULT_PROJECT_NAME; // Ensure the default project is created if needed
         }
    }

     // Ensure the default project exists and is pinned if it's the current project or if there are no other projects
     if (data.currentProject === DEFAULT_PROJECT_NAME || Object.keys(data.projects).length === 0) {
          if (!data.projects[DEFAULT_PROJECT_NAME]) {
              console.warn(`Default project "${DEFAULT_PROJECT_NAME}" missing. Creating default project.`);
              data.projects[DEFAULT_PROJECT_NAME] = { tasks: [], isArchived: false, isPinned: true };
              if (!data.projectOrder.includes(DEFAULT_PROJECT_NAME)) {
                   data.projectOrder.unshift(DEFAULT_PROJECT_NAME); // Add to start
              }
          } else {
               data.projects[DEFAULT_PROJECT_NAME].isPinned = true; // Ensure it's pinned
               // Ensure default is early in the projectOrder, after All Important (conceptually, it's first in the list)
               const defaultIndex = data.projectOrder.indexOf(DEFAULT_PROJECT_NAME);
               if (defaultIndex > 0) { // Move to position 0 in the array (appears after 'All Important')
                    data.projectOrder.splice(defaultIndex, 1); // Remove from current position
                    data.projectOrder.unshift(DEFAULT_PROJECT_NAME); // Add to start
               } else if (defaultIndex === -1) {
                    data.projectOrder.unshift(DEFAULT_PROJECT_NAME); // Add if missing
               }
          }
          data.currentProject = DEFAULT_PROJECT_NAME; // Ensure it's the current view if no other projects
     }


     return data; // Return the cleaned data object
 }


/**
 * Loads project data from localStorage or initializes default data if none exists or data is invalid.
 * Performs data validation and migration for older structures. Loads Undo settings.
 */
function loadProjectsData() {
    // Load Max Undo Steps Setting
    const storedMaxSteps = localStorage.getItem(UNDO_STORAGE_KEY);
    if (storedMaxSteps && !isNaN(parseInt(storedMaxSteps))) {
         const parsedMax = parseInt(storedMaxSteps);
         maxUndoSteps = Math.max(1, Math.min(100, parsedMax)); // Clamp between 1 and 100
    } else {
        maxUndoSteps = DEFAULT_MAX_UNDO_STEPS;
    }
    // Update the input field in the settings modal
    if (maxUndoStepsInput) {
         maxUndoStepsInput.value = maxUndoSteps;
    }
    // Clear history on initial load
    clearUndoHistory();

    const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let loadedData = null;

    if (storedData) {
        try {
            loadedData = JSON.parse(storedData);
            // Validate and clean the loaded data structure
            loadedData = validateAndCleanDataStructure(loadedData);

        } catch (error) {
            console.error("Error parsing stored data, initializing defaults:", error);
            loadedData = null; // Signal to initialize defaults
        }
    }

    // Initialize default if no valid data was loaded OR if validation resulted in an empty projects object
    if (!loadedData || !loadedData.projects || Object.keys(loadedData.projects).length === 0) {
         console.warn("No valid data loaded or projects object is empty. Initializing defaults.");
         initializeDefaultProjectData(); // This initializes projectsData and handles undo/settings defaults
    } else {
         projectsData = loadedData; // Use the validated/cleaned data
         currentProjectName = projectsData.currentProject;
         saveProjectsData(); // Save the cleaned/migrated data immediately
    }
    // updateUIFromState(false); // Initial UI update is handled by the DOMContentLoaded listener now
}

/**
 * Sets up the initial default project and tasks if no data is loaded.
 * Sets default undo settings.
 */
function initializeDefaultProjectData() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

     const defaultProject = DEFAULT_PROJECT_NAME;

    projectsData = {
        currentProject: defaultProject,
        projects: {
            [defaultProject]: {
                tasks: [
                    { id: generateUniqueId(), name: 'Welcome Task', description: 'Click the star to mark important!', status: 'backlog', isImportant: false, dueDate: null, subtasks: [] },
                    { id: generateUniqueId(), name: 'Explore Features', description: 'Try adding tasks & subtasks. Double-click to edit.', status: 'todo', isImportant: false, dueDate: tomorrow.toISOString().split('T')[0], subtasks: [{id: generateUniqueId(), text: 'Convert me to a task!', completed: false}] },
                    { id: generateUniqueId(), name: 'Overdue Example', description: 'This task is overdue.', status: 'todo', isImportant: false, dueDate: yesterday.toISOString().split('T')[0], subtasks: [] }
                ],
                isArchived: false,
                isPinned: true // Pin the default project by default
            }
        },
        projectOrder: [defaultProject] // Initialize order with the default project
    };
    currentProjectName = defaultProject;
    console.log("Initialized with default project data.");

    // Set default max undo steps if not already loaded
    maxUndoSteps = DEFAULT_MAX_UNDO_STEPS;
    localStorage.setItem(UNDO_STORAGE_KEY, maxUndoSteps.toString()); // Save default
    if (maxUndoStepsInput) {
        maxUndoStepsInput.value = maxUndoSteps;
    }
    clearUndoHistory(); // Clear history for default state

    saveProjectsData(); // Save the default data
}

/**
 * Populates the project list in the sidebar based on the projectsData.
 */
function populateProjectList() {
    projectListElement.innerHTML = ''; // Clear existing list

    // Get projects that are not archived
    const activeProjects = Object.keys(projectsData.projects)
                                    .filter(name => projectsData.projects[name] && !projectsData.projects[name].isArchived) // Ensure project data exists
                                    .map(name => ({ name, data: projectsData.projects[name] }));

    // Filter into pinned and unpinned
    const pinnedProjects = activeProjects.filter(p => p.data.isPinned).sort((a, b) => a.name.localeCompare(b.name)); // Sort pinned alphabetically
    const unpinnedProjects = activeProjects.filter(p => !p.data.isPinned);

    // Order unpinned projects based on projectOrder array
    // Create a map for quick lookup
    const unpinnedProjectMap = unpinnedProjects.reduce((map, p) => { map[p.name] = p.data; return map; }, {});
    let orderedUnpinnedProjectNames = projectsData.projectOrder.filter(name => unpinnedProjectMap[name]);

    // Add any unpinned projects missing from projectOrder (shouldn't happen with cleanup, but safety)
     unpinnedProjects.forEach(p => {
          if (!orderedUnpinnedProjectNames.includes(p.name)) {
              orderedUnpinnedProjectNames.push(p.name);
              // Also update projectsData.projectOrder if necessary
              if (!projectsData.projectOrder.includes(p.name)) {
                   projectsData.projectOrder.push(p.name);
                   // saveProjectsData(); // Save the corrected order immediately - potentially heavy if many projects
                   // Better to save at the end of loadProjectsData/validateAndCleanDataStructure or after a drag/drop action
              }
          }
     });


    // Helper to create a list item element
    const createListItem = (name, value, title, isProject = false, isPinned = false, isStatic = false) => {
        const listItem = document.createElement('li');
        listItem.className = `project-list-item flex justify-between items-center p-2 mb-1 rounded-md transition duration-150 ease-in-out font-medium ${value === currentProjectName ? 'active bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'} ${isStatic ? 'static-item' : ''}`;
        listItem.setAttribute('data-project-key', value);

        // Add drag attributes only if not static
        if (!isStatic) {
            listItem.setAttribute('draggable', 'true');
            listItem.setAttribute('data-is-pinned', isPinned ? 'true' : 'false'); // Store pin status for drag/drop
        }


        const nameSpan = document.createElement('span');
        nameSpan.className = 'project-list-item-name flex-grow overflow-hidden text-ellipsis whitespace-nowrap';
         // Cursor is handled by parent .project-list-item for drag, but nameSpan gets pointer for click
         nameSpan.style.cursor = 'pointer'; // Override grab cursor for clicking
        nameSpan.textContent = title;
        nameSpan.addEventListener('click', () => switchProject(value));
         // Allow double-click to rename project
         if (isProject && value !== DEFAULT_PROJECT_NAME) { // Don't allow renaming Default
             nameSpan.title = "Double-click to rename project";
             nameSpan.addEventListener('dblclick', (event) => {
                event.stopPropagation(); // Prevent project switch
                handleInlineEdit(nameSpan, value, 'projectName'); // Pass project name as itemId
             });
         }

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'project-item-controls';


        // Add Pin/Unpin button for actual projects (not special views)
        if (isProject && value !== DEFAULT_PROJECT_NAME) { // Default project is pinned by default, cannot unpin
             const pinButton = document.createElement('button');
             pinButton.className = 'project-pin-button';
             pinButton.innerHTML = `<i class="fas fa-thumbtack"></i>`; // Always use solid icon, style handles color/opacity
             pinButton.title = isPinned ? "Unpin Project" : "Pin Project";
             if (isPinned) {
                  pinButton.style.color = '#facc15'; // Yellow color for pinned
             } else {
                  pinButton.style.color = '#9ca3af'; // Default gray for unpinned
             }
             pinButton.addEventListener('click', (event) => {
                 event.stopPropagation(); // Prevent project switch
                 toggleProjectPin(value);
             });
             controlsDiv.appendChild(pinButton);
         }


        // Add delete button only for actual projects (not default or special views)
        if (isProject && value !== DEFAULT_PROJECT_NAME) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'project-delete-button';
            deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteButton.title = `Delete Project "${name}"`;
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent project switch when clicking delete
                showConfirmation(`Are you sure you want to delete project "${value}"? This will also delete all its tasks and cannot be undone.`, () => {
                    deleteProjectLogic(value);
                });
            });
            controlsDiv.appendChild(deleteButton);
        }

        listItem.appendChild(nameSpan);
        listItem.appendChild(controlsDiv); // Add controls div
        return listItem;
    };

    // Add "All Important Tasks" view item (Static)
    const allImportantItem = createListItem(ALL_PROJECTS_VIEW_TITLE, ALL_PROJECTS_VIEW_KEY, ALL_PROJECTS_VIEW_TITLE, false, false, true); // isProject=false, isStatic=true
    allImportantItem.style.cursor = 'pointer'; // Override grab cursor for this item
     allImportantItem.querySelector('.project-item-controls').style.opacity = 1; // Always show controls if any (though there are none for this item)
    projectListElement.appendChild(allImportantItem);


    // Add pinned projects
    pinnedProjects.forEach(p => {
        projectListElement.appendChild(createListItem(p.name, p.name, p.name, true, true)); // isProject=true, isPinned=true
    });

    // Add separator if there are pinned projects and unpinned projects
    if (pinnedProjects.length > 0 && orderedUnpinnedProjectNames.length > 0) {
        const separator = document.createElement('li');
        separator.className = 'project-list-separator';
        projectListElement.appendChild(separator);
    }

    // Add unpinned projects based on ordered list
    orderedUnpinnedProjectNames.forEach(name => {
        const projectData = projectsData.projects[name];
         if (projectData) { // Ensure project still exists
            projectListElement.appendChild(createListItem(name, name, name, true, false)); // isProject=true, isPinned=false
         }
    });

    // Add drag/drop listeners to project items *after* they are created
    projectListElement.querySelectorAll('.project-list-item[draggable="true"]').forEach(item => {
         item.addEventListener('dragstart', handleProjectDragStart);
         item.addEventListener('dragover', handleProjectDragOver);
         item.addEventListener('dragleave', handleProjectDragLeave);
         item.addEventListener('drop', handleProjectDrop);
         item.addEventListener('dragend', handleProjectDragEnd); // Cleanup drag-over indicators
    });
}

 /**
  * Toggles the `isPinned` status of a project.
  * @param {string} projectName - The name of the project to toggle.
  */
 function toggleProjectPin(projectName) {
    const project = projectsData.projects[projectName];
    if (project && projectName !== DEFAULT_PROJECT_NAME) { // Cannot unpin the default project
         saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
         project.isPinned = !project.isPinned;
         // Update projectOrder if unpinning a pinned item or pinning an unpinned one
         // The projectOrder array should primarily contain the order of UNPINNED items.
         // Pinned items are sorted alphabetically and displayed first, but their drag/drop
         // operations should ideally only reorder among *other pinned items*.
         // Let's simplify: projectOrder only dictates the order of UNPINNED items.
         // Pinned items are sorted alphabetically.
         if (project.isPinned) {
              // Remove from projectOrder if pinning
              projectsData.projectOrder = projectsData.projectOrder.filter(name => name !== projectName);
         } else {
              // Add to end of projectOrder if unpinning
              if (!projectsData.projectOrder.includes(projectName)) {
                   projectsData.projectOrder.push(projectName);
              }
         }

         saveProjectsData();
         updateUIFromState(false); // Re-render sidebar to reflect pin status and order
    } else if (projectName === DEFAULT_PROJECT_NAME) {
         alert(`"${DEFAULT_PROJECT_NAME}" is the default project and cannot be unpinned.`);
    }
 }


/**
 * Switches the current view to the selected project or special view.
 * @param {string} projectKey - The name of the project or the special view key (e.g., ALL_PROJECTS_VIEW_KEY).
 */
function switchProject(projectKey) {
    // Close any active inline edits before switching
    if (activeInlineEditInput) activeInlineEditInput.blur();
    if (activeInlineDateInput) activeInlineDateInput.blur();

    if (projectKey === ALL_PROJECTS_VIEW_KEY || (projectsData.projects[projectKey] && !projectsData.projects[projectKey].isArchived)) {
         // Switching views is generally NOT undoable.
         currentProjectName = projectKey;
         projectsData.currentProject = currentProjectName; // Update the current project in state
         saveProjectsData(); // Still save the preference
         updateUIFromState(false); // Update UI *without* saving undo state
    } else {
        console.error("Selected project/view not found or is archived:", projectKey);
        // Optionally switch to a default view or show an error
        // If the current project becomes archived/deleted, loadProjectsData/validateAndCleanDataStructure handles switching to a valid one
         const activeProjectKeys = Object.keys(projectsData.projects).filter(k => projectsData.projects[k] && !projectsData.projects[k]?.isArchived);
         if (!activeProjectKeys.includes(currentProjectName) && currentProjectName !== ALL_PROJECTS_VIEW_KEY) {
             // This case should be handled by the data cleanup on load/delete, but a fallback is good
             const firstActive = activeProjectKeys[0] || ALL_PROJECTS_VIEW_KEY;
              currentProjectName = firstActive;
              projectsData.currentProject = currentProjectName;
              saveProjectsData();
              updateUIFromState(false);
         }
    }
}

/**
 * Creates a new project from the data entered in the project modal.
 * @returns {boolean} True if the project was created successfully, false otherwise.
 */
function createNewProjectFromModal() {
    const newName = modalProjectNameInput.value.trim();
    if (!newName) {
        modalAddProjectError.textContent = "Project name cannot be empty.";
        modalAddProjectError.classList.remove('hidden');
        modalProjectNameInput.focus();
        return false; // Indicate failure
    }
    if (projectsData.projects[newName]) {
        modalAddProjectError.textContent = `Project "${newName}" already exists.`;
        modalAddProjectError.classList.remove('hidden');
        modalProjectNameInput.focus();
        return false; // Indicate failure
    }
     if (newName === ALL_PROJECTS_VIEW_TITLE) {
          modalAddProjectError.textContent = `"${ALL_PROJECTS_VIEW_TITLE}" is a reserved name.`;
          modalAddProjectError.classList.remove('hidden');
          modalProjectNameInput.focus();
          return false;
     }


    // Clear error and create project
    modalAddProjectError.classList.add('hidden');
    saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
    projectsData.projects[newName] = { tasks: [], isArchived: false, isPinned: false }; // New projects are unpinned
    // Add to projectOrder unless it's already there (shouldn't be for a new project)
    if (!projectsData.projectOrder.includes(newName)) {
         projectsData.projectOrder.push(newName); // Add to the end of the unpinned order
    }

    currentProjectName = newName; // Switch to the new project
    projectsData.currentProject = currentProjectName;
    saveProjectsData();
    updateUIFromState(false); // Update UI *after* change, without saving state again
    return true; // Indicate success
}

/**
 * Creates the HTML element for a single subtask.
 * @param {object} subtask - The subtask data object.
 * @param {string|number} taskId - The ID of the parent task.
 * @returns {HTMLElement} The subtask item div element.
 */
function createSubtaskElement(subtask, taskId) {
     // Basic validation before creating element (should be handled by validateAndCleanDataStructure, but defensive)
     if (!subtask || typeof subtask !== 'object' || typeof subtask.text !== 'string') {
          console.error("Invalid subtask data passed to createSubtaskElement:", subtask);
          return null; // Return null if data is fundamentally bad
     }

    const item = document.createElement('div');
    item.className = 'subtask-item text-gray-300 hover:bg-gray-700'; // Added hover effect
    item.setAttribute('data-subtask-id', subtask.id);
    item.setAttribute('data-parent-task-id', taskId);
    item.setAttribute('draggable', 'true');

    const contentDiv = document.createElement('div');
    contentDiv.className = 'subtask-item-content';

    // Checkbox for completion
    const checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.checked = !!subtask.completed; // Ensure boolean
    checkbox.className = 'mr-2 cursor-pointer form-checkbox h-4 w-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-600 focus:ring-offset-gray-800';
    checkbox.addEventListener('change', (event) => {
        event.stopPropagation(); // Prevent card details toggle
        toggleSubtaskCompletion(taskId, subtask.id);
    });
     // Prevent card details toggle when clicking checkbox itself
    checkbox.addEventListener('click', (event) => event.stopPropagation());

    // Subtask text
    const text = document.createElement('span');
    text.textContent = subtask.text;
    if (!!subtask.completed) text.classList.add('completed'); // Ensure boolean check
     // Prevent card details toggle when clicking text (allow selection)
    text.addEventListener('click', (event) => event.stopPropagation());

    contentDiv.appendChild(checkbox);
    contentDiv.appendChild(text);

    // Action buttons container
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'subtask-item-actions';

    // Button to duplicate subtask
    const duplicateButton = document.createElement('button');
    duplicateButton.className = 'subtask-action-button duplicate';
    duplicateButton.innerHTML = '<i class="fas fa-copy"></i>'; // Icon for duplicate
    duplicateButton.title = 'Duplicate Subtask';
    duplicateButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent card details toggle
        duplicateSubtaskLogic(taskId, subtask.id); // Call duplication logic
    });
    actionsDiv.appendChild(duplicateButton);


    // Button to convert subtask to a full task
    const convertButton = document.createElement('button');
    convertButton.className = 'subtask-action-button convert';
    convertButton.innerHTML = '<i class="fas fa-level-up-alt"></i>'; // Icon for convert
    convertButton.title = 'Convert to Task';
    convertButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent card details toggle
        showConfirmation(`Convert subtask "${subtask.text}" into a new task?`, () => {
            convertSubtaskToTask(taskId, subtask.id);
        });
    });
    actionsDiv.appendChild(convertButton);

     // Delete subtask button
     const deleteButton = document.createElement('button');
     deleteButton.className = 'subtask-action-button delete';
     deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
     deleteButton.title = "Delete Subtask";
     deleteButton.addEventListener('click', (event) => {
          event.stopPropagation(); // Prevent card details toggle
          showConfirmation(`Are you sure you want to delete subtask "${subtask.text}"?`, () => {
              deleteSubtaskLogic(taskId, subtask.id);
          });
     });
    actionsDiv.appendChild(deleteButton);


    item.appendChild(contentDiv);
    item.appendChild(actionsDiv); // Add actions div

    // Add drag handlers
    item.addEventListener('dragstart', handleSubtaskDragStart);
    item.addEventListener('dragend', handleSubtaskDragEnd);
    // Add dragover listener for reordering within the same parent
    item.addEventListener('dragover', handleTaskDragOver); // Reuse task dragover logic for subtask targets
    item.addEventListener('dragleave', handleTaskDragLeave); // Reuse task dragleave logic for subtask targets


    return item;
}

/**
 * Creates the HTML element for a single task card.
 * @param {object} task - The task data object.
 * @param {string|null} [projectName=null] - The name of the project (used in "All Important" view).
 * @returns {HTMLElement} The task card div element.
 */
function createTaskElement(task, projectName = null) {
    // Basic validation before creating element (should be handled by validateAndCleanDataStructure, but defensive)
     if (!task || typeof task !== 'object' || typeof task.name !== 'string') {
          console.error("Invalid task data passed to createTaskElement:", task);
          return null; // Return null if data is fundamentally bad
     }

    const taskCard = document.createElement('div');
    // Base classes + hover effect class from Tailwind
    taskCard.className = 'task-card bg-gray-700 shadow border border-gray-600 rounded-md'; // Removed hover:shadow-lg, handled by CSS
    taskCard.setAttribute('draggable', 'true');
    taskCard.setAttribute('data-task-id', task.id);
    taskCard.setAttribute('data-task-status', task.status); // Store status for drag/drop checks
    if (projectName) { // Add project name if provided (for 'All Important' view)
        taskCard.setAttribute('data-project-name', projectName);
    }

    // --- Task Header ---
    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header text-gray-100 p-3';
    taskHeader.addEventListener('click', toggleDetails); // Toggle details on header click

    const headerLeft = document.createElement('div');
    headerLeft.className = 'task-header-left';

    const nameContainer = document.createElement('div');
    nameContainer.className = 'task-name-container';

    const taskNameSpan = document.createElement('span');
    taskNameSpan.className = 'font-semibold task-name-span'; // Class for targeting inline edit
    taskNameSpan.textContent = task.name;
    taskNameSpan.title = "Double-click to edit name";
    taskNameSpan.addEventListener('dblclick', (event) => {
        event.stopPropagation(); // Prevent details toggle
        handleInlineEdit(taskNameSpan, task.id, 'name');
    });

    // Subtask completion indicator (e.g., "(1/3)")
    const subtaskIndicator = document.createElement('span');
    subtaskIndicator.className = 'text-xs text-gray-400 ml-1 flex-shrink-0'; // Prevent shrinking
     // Check if subtasks is an array before accessing length or filtering
    const totalSubtasks = Array.isArray(task.subtasks) ? task.subtasks.length : 0;
    const completedCount = Array.isArray(task.subtasks) ? task.subtasks.filter(st => !!st.completed).length : 0; // Ensure boolean check
    subtaskIndicator.textContent = `(${completedCount}/${totalSubtasks})`;
    // Hide indicator if no subtasks
    if (totalSubtasks === 0) {
         subtaskIndicator.style.display = 'none';
    }

    nameContainer.appendChild(taskNameSpan);
    nameContainer.appendChild(subtaskIndicator);
    headerLeft.appendChild(nameContainer);

    const headerRight = document.createElement('div');
    headerRight.className = 'task-header-right'; // Buttons appear on hover

    // Button to duplicate task
    const duplicateButton = document.createElement('button');
    duplicateButton.className = 'task-action-button duplicate';
    duplicateButton.innerHTML = '<i class="fas fa-copy"></i>'; // Icon for duplicate
    duplicateButton.title = 'Duplicate Task';
    duplicateButton.addEventListener('click', (event) => {
         event.stopPropagation(); // Prevent details toggle
         // Pass the original project name from the data attribute if available
         duplicateTaskLogic(task.id, taskCard.getAttribute('data-project-name'));
    });
    headerRight.appendChild(duplicateButton);


    // Importance toggle (star icon)
    const importanceToggle = document.createElement('button');
    importanceToggle.className = `task-action-button task-importance-toggle ${task.isImportant ? 'important' : ''}`;
    importanceToggle.innerHTML = `<i class="fa-${task.isImportant ? 'solid' : 'regular'} fa-star"></i>`; // Solid or regular star
    importanceToggle.title = task.isImportant ? "Mark as not important" : "Mark as important";
    importanceToggle.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent details toggle
        toggleTaskImportance(task.id);
    });
    headerRight.appendChild(importanceToggle);


    // Delete task button (trash icon)
    const deleteButton = document.createElement('button');
    deleteButton.className = 'task-action-button delete';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.title = "Delete Task";
    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent details toggle
        showConfirmation(`Are you sure you want to delete task "${task.name}"?`, () => {
            deleteTaskLogic(task.id);
        });
    });
    headerRight.appendChild(deleteButton);


    taskHeader.appendChild(headerLeft);
    taskHeader.appendChild(headerRight);
    taskCard.appendChild(taskHeader);

    // Project label (only shown in "All Important" view)
    if (projectName) {
        const projectLabel = document.createElement('span');
        projectLabel.className = 'task-project-label px-3 pb-1 text-gray-400 text-xs block'; // Added block display
        projectLabel.textContent = `Project: ${projectName}`;
        taskCard.appendChild(projectLabel);
    }

    // --- Task Details (Collapsible) ---
    const taskDetails = document.createElement('div');
    taskDetails.className = 'task-details'; // Initially hidden via CSS max-height: 0

    // Task Description
    if (task.description || task.description === '') { // Render even if empty for editing
        const taskDescriptionDiv = document.createElement('div');
        taskDescriptionDiv.className = 'task-description text-gray-300';
        taskDescriptionDiv.textContent = task.description || ''; // Display empty string if null/undefined
        taskDescriptionDiv.title = "Double-click to edit description";
        taskDescriptionDiv.addEventListener('dblclick', (event) => {
            event.stopPropagation(); // Prevent details toggle
            handleInlineEdit(taskDescriptionDiv, task.id, 'description');
        });
        taskDetails.appendChild(taskDescriptionDiv);
    }

    // Due Date Display and Edit
    const dueDateContainer = document.createElement('div');
    dueDateContainer.className = 'task-due-date';

    const dueDateText = document.createElement('span');
    dueDateText.className = 'task-due-date-text';
    dueDateText.textContent = 'Due: ';

    const dueDateValueSpan = document.createElement('span');
    dueDateValueSpan.className = 'task-due-date-value';
    dueDateValueSpan.setAttribute('data-task-id', task.id); // Link span to task ID for updates

    if (task.dueDate) {
        dueDateValueSpan.textContent = task.dueDate;
        // Check if overdue (ignoring time part)
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = new Date(task.dueDate + 'T00:00:00'); // Ensure date comparison is correct

        if (dueDate < today && task.status !== 'done') {
            dueDateValueSpan.classList.add('overdue');
            dueDateValueSpan.title = "Overdue!";
        }
    } else {
        dueDateValueSpan.textContent = 'Not set';
        dueDateValueSpan.classList.add('not-set');
    }

    // Edit Due Date Icon (Calendar)
    const editDueDateIcon = document.createElement('i');
    editDueDateIcon.className = 'fas fa-calendar-alt task-due-date-edit-icon ml-1';
    editDueDateIcon.title = 'Edit due date';
    editDueDateIcon.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent details toggle
        handleDueDateEdit(dueDateValueSpan, task.id);
    });

    dueDateText.appendChild(dueDateValueSpan); // Add value span inside text span
    dueDateContainer.appendChild(dueDateText);
    dueDateContainer.appendChild(editDueDateIcon);
    taskDetails.appendChild(dueDateContainer);

    // Subtask List
    const subtaskList = document.createElement('div');
    subtaskList.className = 'subtask-list border-l-2 border-gray-600'; // Add left border for visual structure
    // Add dragover/drop listeners here for dropping subtasks onto an *empty* subtask list area
     subtaskList.addEventListener('dragover', handleTaskDragOver); // Re-use task dragover for subtask drops
     subtaskList.addEventListener('dragleave', handleTaskDragLeave); // Re-use task dragleave for subtask drops
     subtaskList.addEventListener('drop', handleTaskDrop); // Re-use task drop for subtask drops

     if(Array.isArray(task.subtasks)) { // Only iterate if subtasks is a valid array
         task.subtasks.forEach(subtask => {
             const subtaskElement = createSubtaskElement(subtask, task.id);
             if (subtaskElement) { // Append only if element creation was successful (data was valid)
                  subtaskList.appendChild(subtaskElement);
             }
         });
     }
    taskDetails.appendChild(subtaskList);

    // Add Subtask Form (Input Only)
    const addSubtaskFormContainer = document.createElement('div');
    addSubtaskFormContainer.className = 'add-subtask-form-container';

    const addSubtaskForm = document.createElement('div');
    addSubtaskForm.className = 'add-subtask-form'; // Adjusted padding slightly as there's no button now

    const subtaskInput = document.createElement('input');
    subtaskInput.setAttribute('type', 'text');
    subtaskInput.setAttribute('placeholder', 'Add subtask & press Enter...'); // Updated placeholder
     // Made input take full width within its container
    subtaskInput.className = 'add-subtask-input flex-grow py-1 px-2 text-sm bg-gray-600 border border-gray-500 rounded-md text-gray-200 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 w-full';
    // Add subtask on Enter key press
    subtaskInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission/newline
            handleAddSubtask(task.id, subtaskInput);
        }
    });
    // Prevent details toggle when clicking input
     subtaskInput.addEventListener('click', (event) => event.stopPropagation());

    // --- Removed the subtask "Add" button element and its appending ---

    addSubtaskForm.appendChild(subtaskInput);
    addSubtaskFormContainer.appendChild(addSubtaskForm);
    taskDetails.appendChild(addSubtaskFormContainer);

    taskCard.appendChild(taskDetails); // Add details section to card

    // --- Add Drag and Drop Event Listeners to the Task Card ---
    taskCard.addEventListener('dragstart', handleTaskDragStart);
    taskCard.addEventListener('dragend', handleTaskDragEnd);
    // Listeners for dropping other tasks *onto* this task (for reordering) or subtasks onto this task
    taskCard.addEventListener('dragover', handleTaskDragOver); // Handles both task-on-task and subtask-on-task/subtask
    taskCard.addEventListener('dragleave', handleTaskDragLeave); // Handles leave for both
    taskCard.addEventListener('drop', handleTaskDrop); // Handles drop for both

    return taskCard;
}

/**
 * Shows the confirmation modal with a specific message.
 * @param {string} message - The message to display in the modal.
 * @param {function} onConfirm - The callback function to execute if the user confirms.
 */
function showConfirmation(message, onConfirm) {
    confirmationMessage.textContent = message;
    confirmationCallback = onConfirm; // Store the callback
    confirmationModal.classList.add('open');
}

/**
 * Closes the confirmation modal and clears the callback.
 */
function closeConfirmationModal() {
    confirmationModal.classList.remove('open');
    confirmationCallback = null; // Clear the callback
}

/**
 * Handles the confirmation action when the "Confirm" button is clicked.
 * Executes the stored callback function.
 */
function handleConfirmation() {
    if (typeof confirmationCallback === 'function') {
        try {
            confirmationCallback(); // Execute the stored action
        } catch(error) {
            console.error("Error executing confirmation callback:", error);
            // Optionally inform the user
        }
    }
    closeConfirmationModal(); // Close modal regardless of callback success/failure
}


/**
 * Logic to delete a task after confirmation.
 * @param {string|number} taskId - The ID of the task to delete.
 */
function deleteTaskLogic(taskId) {
    let taskFoundAndRemoved = false;
    let stateSaved = false; // Ensure state is saved only once if task found
    for (const projName in projectsData.projects) {
        const projectData = projectsData.projects[projName];
        if (projectData && Array.isArray(projectData.tasks)) {
            const taskIndex = projectData.tasks.findIndex(task => task && task.id == taskId); // Add task check
            if (taskIndex !== -1) {
                if (!stateSaved) {
                     saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
                     stateSaved = true;
                }
                projectData.tasks.splice(taskIndex, 1); // Remove the task
                taskFoundAndRemoved = true;
                break; // Exit loop once task is found and removed
            }
        }
    }

    if (taskFoundAndRemoved) {
        saveProjectsData();
        updateUIFromState(false); // Re-render the board using the unified updater
    } else {
        console.error("Task not found for deletion:", taskId);
        // Optionally inform the user
    }
}

 /**
  * Logic to delete a subtask.
  * @param {string|number} taskId - The ID of the parent task.
  * @param {string|number} subtaskId - The ID of the subtask to delete.
  */
 function deleteSubtaskLogic(taskId, subtaskId) {
     let subtaskFoundAndRemoved = false;
     let stateSaved = false;

     // Find the parent task across all projects
     for (const projName in projectsData.projects) {
         const projectData = projectsData.projects[projName];
         if (projectData && Array.isArray(projectData.tasks)) {
             const task = projectData.tasks.find(t => t && t.id == taskId); // Add task check
             if (task && Array.isArray(task.subtasks)) {
                 const subtaskIndex = task.subtasks.findIndex(st => st && st.id == subtaskId); // Add subtask check
                 if (subtaskIndex !== -1) {
                      if (!stateSaved) {
                          saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
                          stateSaved = true;
                      }
                     task.subtasks.splice(subtaskIndex, 1); // Remove the subtask
                     subtaskFoundAndRemoved = true;
                     break; // Subtask found and removed
                 }
             }
         }
     }

     if (subtaskFoundAndRemoved) {
         saveProjectsData();
         updateUIFromState(false); // Re-render the parent task card
     } else {
         console.error("Subtask not found for deletion:", {taskId, subtaskId});
         // Optionally inform the user
     }
 }


/**
 * Logic to delete a project after confirmation.
 * Prevents deletion of the default project or the last remaining project.
 * @param {string} projectName - The name of the project to delete.
 */
function deleteProjectLogic(projectName) {
     // Prevent deletion of the default project
     if (!projectsData.projects[projectName] || projectName === DEFAULT_PROJECT_NAME) {
         console.warn(`Attempted to delete protected project: ${projectName}`);
         alert(`Cannot delete the "${DEFAULT_PROJECT_NAME}" project.`); // Use alert for critical user feedback
         return;
     }

     // Prevent deletion of the last active project
     const activeProjects = Object.keys(projectsData.projects).filter(p => projectsData.projects[p] && !projectsData.projects[p]?.isArchived);
     if (activeProjects.length <= 1 && activeProjects.includes(projectName)) {
         alert("Cannot delete the last active project.");
         return;
     }

     saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
     // Delete the project data
     delete projectsData.projects[projectName];

     // Remove from project order array
     projectsData.projectOrder = projectsData.projectOrder.filter(name => name !== projectName);


     // If the deleted project was the current view, switch to another project or default view
     if (currentProjectName === projectName) {
         // Find the first available non-archived project, or fall back to 'All Important'
         currentProjectName = Object.keys(projectsData.projects).filter(p => projectsData.projects[p] && !projectsData.projects[p]?.isArchived)[0] || ALL_PROJECTS_VIEW_KEY;
         // If the new current project is the default one and it's still in the list (it should be), keep it pinned
         if (currentProjectName === DEFAULT_PROJECT_NAME && projectsData.projects[DEFAULT_PROJECT_NAME]) {
            projectsData.projects[DEFAULT_PROJECT_NAME].isPinned = true; // Ensure default stays pinned
         }
         projectsData.currentProject = currentProjectName;
     }

     saveProjectsData();
     updateUIFromState(false); // Update the UI using the unified function
 }


/**
 * Toggles the importance (star) of a task.
 * @param {string|number} taskId - The ID of the task to toggle.
 */
function toggleTaskImportance(taskId) {
    let taskFound = false;
    let stateSaved = false;
    // Find the task across all projects
    for (const projName in projectsData.projects) {
        const projectData = projectsData.projects[projName];
        if (projectData && Array.isArray(projectData.tasks)) {
            const taskIndex = projectData.tasks.findIndex(task => task && task.id == taskId); // Add task check
            if (taskIndex !== -1) {
                if (!stateSaved) {
                    saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
                    stateSaved = true;
                }
                projectData.tasks[taskIndex].isImportant = !projectData.tasks[taskIndex].isImportant; // Toggle boolean
                taskFound = true;
                break; // Task found and updated
            }
        }
    }

    if (taskFound) {
        saveProjectsData();
        updateUIFromState(false); // Re-render to reflect the change
    } else {
        console.error("Task not found for importance toggle:", taskId);
    }
}

 /**
  * Duplicates a task, including its subtasks.
  * @param {string|number} taskId - The ID of the task to duplicate.
  * @param {string|null} [originalProjectName=null] - The name of the original project (needed for 'All Important' view).
  */
 function duplicateTaskLogic(taskId, originalProjectName = null) {
     let sourceTask = null;
     let targetProjectName = null;

     // Find the source task and its project name
     if (originalProjectName && projectsData.projects[originalProjectName]) {
         // If originalProjectName is provided (e.g., from 'All Important' view)
         sourceTask = projectsData.projects[originalProjectName].tasks?.find(task => task && task.id == taskId); // Add task check
         targetProjectName = originalProjectName; // Duplicate in the same project
     } else {
         // If not from 'All Important' view, assume it's in the current project
         if (currentProjectName !== ALL_PROJECTS_VIEW_KEY && projectsData.projects[currentProjectName]) {
             sourceTask = projectsData.projects[currentProjectName].tasks?.find(task => task && task.id == taskId); // Add task check
             targetProjectName = currentProjectName; // Duplicate in the current project
         }
     }


     if (!sourceTask || !targetProjectName || !projectsData.projects[targetProjectName]) {
         console.error("Source task or target project not found for duplication:", { taskId, originalProjectName, currentProjectName });
         alert("Error: Could not find the task to duplicate.");
         return;
     }

     saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE

     // Create a deep copy of the source task
     const duplicatedTask = JSON.parse(JSON.stringify(sourceTask));

     // Assign a new unique ID to the duplicated task
     duplicatedTask.id = generateUniqueId();
     // Modify the name
     duplicatedTask.name = `${duplicatedTask.name} (Copy)`;

     // Recursively assign new unique IDs to all subtasks
     if (Array.isArray(duplicatedTask.subtasks)) {
         duplicatedTask.subtasks = duplicatedTask.subtasks.map(subtask => {
              // Ensure subtask is valid before copying
              if (!subtask || typeof subtask !== 'object') {
                  console.warn("Skipping invalid subtask during duplication:", subtask);
                  return null; // Mark for filtering
              }
             const duplicatedSubtask = JSON.parse(JSON.stringify(subtask));
             duplicatedSubtask.id = generateUniqueId(); // New ID for the subtask copy
             // Optionally modify subtask text too: duplicatedSubtask.text = `${duplicatedSubtask.text} (Copy)`;
             return duplicatedSubtask;
         }).filter(st => st !== null); // Filter out any null entries
     } else {
         duplicatedTask.subtasks = []; // Ensure subtasks is an array
     }

     // Find the index of the original task in the target project's task list
     const targetProjectTasks = projectsData.projects[targetProjectName].tasks;
     const originalTaskIndex = targetProjectTasks.findIndex(task => task && task.id == taskId); // Add task check

     // Add the duplicated task to the target project's task list
     if (originalTaskIndex !== -1) {
          // Insert the copy immediately after the original task
         targetProjectTasks.splice(originalTaskIndex + 1, 0, duplicatedTask);
     } else {
          // If original task index not found (e.g., data inconsistency?), add to the end
           if (!Array.isArray(targetProjectTasks)) projectsData.projects[targetProjectName].tasks = []; // Ensure it's an array
          targetProjectTasks.push(duplicatedTask);
     }


     saveProjectsData();
     updateUIFromState(false); // Re-render to show the new task
 }

/**
 * Duplicates a subtask.
 * @param {string|number} parentTaskId - The ID of the parent task.
 * @param {string|number} subtaskId - The ID of the subtask to duplicate.
 */
 function duplicateSubtaskLogic(parentTaskId, subtaskId) {
     let parentTask = null;
     let subtaskIndex = -1;
     let subtaskData = null;

     // Find the parent task and the subtask within it
     for (const projName in projectsData.projects) {
         const projectData = projectsData.projects[projName];
         if (projectData && Array.isArray(projectData.tasks)) {
             parentTask = projectData.tasks.find(task => task && task.id == parentTaskId); // Add task check
             if (parentTask && Array.isArray(parentTask.subtasks)) {
                 subtaskIndex = parentTask.subtasks.findIndex(st => st && st.id == subtaskId); // Add subtask check
                 if (subtaskIndex !== -1) {
                     subtaskData = parentTask.subtasks[subtaskIndex]; // Found subtask data
                     break; // Exit loop
                 }
             }
         }
         parentTask = null; // Reset if task not found in this project
     }

     if (!parentTask || subtaskIndex === -1 || !subtaskData || typeof subtaskData !== 'object') { // Add check for subtaskData validity
         console.error("Parent task or subtask not found/invalid for duplication:", { parentTaskId, subtaskId });
         alert("Error: Could not find the subtask to duplicate.");
         return;
     }

     saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE

     // Create a copy of the subtask
     const duplicatedSubtask = JSON.parse(JSON.stringify(subtaskData));

     // Assign a new unique ID
     duplicatedSubtask.id = generateUniqueId();
     // Modify the text
     duplicatedSubtask.text = `${duplicatedSubtask.text} (Copy)`;

     // Insert the duplicated subtask immediately after the original in the parent task's subtasks array
     // Ensure parentTask.subtasks is an array before splicing
     if (!Array.isArray(parentTask.subtasks)) parentTask.subtasks = [];
     parentTask.subtasks.splice(subtaskIndex + 1, 0, duplicatedSubtask);

     saveProjectsData();
     updateUIFromState(false); // Re-render the parent task card
 }


/**
 * Handles the start of inline editing for task name, description, or project name.
 * Replaces the display element (span, div) with an input or textarea.
 * @param {HTMLElement} elementToEdit - The span or div element being edited.
 * @param {string|number} itemId - The ID of the task or the name of the project being edited.
 * @param {'name'|'description'|'projectName'} fieldType - The type of field being edited.
 */
function handleInlineEdit(elementToEdit, itemId, fieldType) {
    // If another inline edit is already active, cancel it first
    if (activeInlineEditInput || activeInlineDateInput) {
        activeInlineEditInput?.blur(); // Trigger blur to save/cancel existing text edit
        activeInlineDateInput?.blur(); // Trigger blur to save/cancel existing date edit
    }

    elementToEdit.classList.add('editing'); // Hide original element using CSS
    let inputElement;
    let originalValue = elementToEdit.textContent;

    // Create textarea for description, input for others
    if (fieldType === 'description') {
        inputElement = document.createElement('textarea');
        inputElement.className = 'inline-edit-textarea'; // Specific class for styling textarea
        inputElement.value = originalValue;
        inputElement.rows = 3; // Start with a reasonable size
    } else { // 'name' or 'projectName'
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.className = 'inline-edit-input';
        inputElement.value = originalValue;
    }

    activeInlineEditInput = inputElement; // Track the active input
    elementToEdit.parentNode.insertBefore(inputElement, elementToEdit.nextSibling); // Insert input after the original element
    inputElement.focus(); // Focus the input
    inputElement.select(); // Select the text

    // --- Event Handlers for the Input ---
    const cleanup = () => {
        // Remove input and show original element
        if (inputElement.parentNode) {
            inputElement.parentNode.removeChild(inputElement);
        }
        elementToEdit.classList.remove('editing');
        activeInlineEditInput = null; // Clear active input tracker
        // Remove listeners to prevent memory leaks
        inputElement.removeEventListener('blur', saveEdit);
        inputElement.removeEventListener('keydown', handleKeyDown);
    };

    const saveEdit = () => {
        const newValue = inputElement.value.trim();
        let dataChanged = false; // Flag to track if actual data modification occurred

        if (fieldType === 'projectName') {
            const originalProjectName = itemId; // In this case, itemId is the original name
            if (newValue && newValue !== originalProjectName) {
                // Check for name collision
                if (projectsData.projects[newValue]) {
                    alert(`Project "${newValue}" already exists.`);
                    inputElement.focus(); // Keep focus on input
                    return; // Prevent closing the input
                }
                 if (newValue === ALL_PROJECTS_VIEW_TITLE) {
                      alert(`"${ALL_PROJECTS_VIEW_TITLE}" is a reserved name.`);
                      inputElement.focus();
                      return;
                 }
                 if (newValue === DEFAULT_PROJECT_NAME && originalProjectName !== DEFAULT_PROJECT_NAME) {
                      alert(`"${DEFAULT_PROJECT_NAME}" is a reserved name and cannot be used for a new project.`);
                      inputElement.focus();
                      return;
                 }

                // Rename the project
                saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
                // Copy project data to the new name
                projectsData.projects[newValue] = projectsData.projects[originalProjectName];
                // Update projectOrder array with the new name
                const orderIndex = projectsData.projectOrder.indexOf(originalProjectName);
                if (orderIndex !== -1) {
                    projectsData.projectOrder[orderIndex] = newValue;
                }
                // Delete the old project key
                delete projectsData.projects[originalProjectName];

                // Update current project if it was the one renamed
                if(currentProjectName === originalProjectName) {
                   currentProjectName = newValue;
                   projectsData.currentProject = newValue;
                }
                saveProjectsData();
                elementToEdit.textContent = newValue; // Update the display element
                dataChanged = true;
            } else if (!newValue) {
                alert("Project name cannot be empty.");
                inputElement.focus(); // Keep focus
                return; // Prevent closing
            } else {
                // No change or invalid name, revert display (handled by cleanup)
            }
        }
        else { // Editing task 'name' or 'description'
            // Task name cannot be empty
            if (fieldType === 'name' && !newValue) {
                alert("Task name cannot be empty.");
                inputElement.focus();
                return; // Prevent closing
            }

            // Find the task and update the field
            let taskFound = false;
            let stateSaved = false;
            // Iterate through projects to find the task
            for (const projName in projectsData.projects) {
                const projectData = projectsData.projects[projName];
                if (projectData && Array.isArray(projectData.tasks)) {
                    const taskIndex = projectData.tasks.findIndex(task => task && task.id == itemId); // itemId is task ID here; Add task check
                    if (taskIndex !== -1 && projectData.tasks[taskIndex]) { // Ensure task at index is valid
                        // Only save state if the value actually changed
                        if (projectData.tasks[taskIndex][fieldType] !== newValue) {
                             if (!stateSaved) {
                                 saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
                                 stateSaved = true;
                             }
                            projectData.tasks[taskIndex][fieldType] = newValue; // Update the specific field
                            saveProjectsData();
                            dataChanged = true; // Mark data as changed
                        }
                        elementToEdit.textContent = newValue; // Update display element regardless
                        taskFound = true;
                        break; // Task found and updated
                    }
                }
            }

            if (!taskFound) {
                console.error("Task not found for editing:", itemId);
                elementToEdit.textContent = originalValue; // Revert display if task not found
            }
        }

        cleanup(); // Remove input, remove listeners

        // Update UI only if data actually changed
        if (dataChanged) {
            updateUIFromState(false); // Update UI without saving state again
        }
    };

    const cancelEdit = () => {
        elementToEdit.textContent = originalValue; // Revert text
        cleanup(); // Remove input
    };

    // Handle Enter (save) and Escape (cancel) keys
    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            // Allow Shift+Enter for newlines in textarea
            if (fieldType === 'description' && event.shiftKey) {
                return;
            }
            event.preventDefault(); // Prevent default action (like newline in input)
            inputElement.blur(); // Trigger saveEdit via blur
        } else if (event.key === 'Escape') {
            cancelEdit();
        }
    };

    // Add listeners to the input element
    inputElement.addEventListener('blur', saveEdit); // Save on losing focus
    inputElement.addEventListener('keydown', handleKeyDown);
}

/**
 * Handles the start of inline editing for a task's due date.
 * Replaces the date display span with a date input element.
 * @param {HTMLElement} dateValueSpan - The span element displaying the current due date.
 * @param {string|number} taskId - The ID of the task whose due date is being edited.
 */
function handleDueDateEdit(dateValueSpan, taskId) {
    // Cancel any other active inline edit first
    if (activeInlineEditInput || activeInlineDateInput) {
        activeInlineEditInput?.blur();
        activeInlineDateInput?.blur();
    }

    const originalText = dateValueSpan.textContent;
    // Get current date value (empty string if 'Not set')
    const currentDueDate = originalText === 'Not set' ? '' : originalText;
    dateValueSpan.classList.add('editing'); // Hide the original span

    // Create date input
    const inputElement = document.createElement('input');
    inputElement.type = 'date';
    inputElement.className = 'inline-edit-date'; // Class for styling
    inputElement.value = currentDueDate; // Set initial value
    inputElement.style.colorScheme = 'dark'; // Hint for dark mode date picker

    activeInlineDateInput = inputElement; // Track the active date input
    // Insert input after the original span
    dateValueSpan.parentNode.insertBefore(inputElement, dateValueSpan.nextSibling);
    inputElement.focus(); // Focus the input

    // --- Event Handlers for Date Input ---
    const cleanup = () => {
        if (inputElement.parentNode) {
            inputElement.parentNode.removeChild(inputElement);
        }
        dateValueSpan.classList.remove('editing'); // Show original span again
        activeInlineDateInput = null; // Clear tracker
        // Remove listeners
        inputElement.removeEventListener('blur', saveDateEdit);
        inputElement.removeEventListener('change', saveDateEdit); // Save immediately on date selection
        inputElement.removeEventListener('keydown', handleDateKeyDown);
    };

    const saveDateEdit = () => {
        const newDateValue = inputElement.value || null; // Store as null if empty
        let dataChanged = false; // Flag if data was actually modified

        // Find the task and update its due date
        let taskFound = false;
        let stateSaved = false;
         // Iterate through projects to find the task
        for (const projName in projectsData.projects) {
            const projectData = projectsData.projects[projName];
            if (projectData && Array.isArray(projectData.tasks)) {
                const taskIndex = projectData.tasks.findIndex(task => task && task.id == taskId); // Add task check
                if (taskIndex !== -1 && projectData.tasks[taskIndex]) { // Ensure task at index is valid
                     // Only save state if the value actually changed
                     if (projectData.tasks[taskIndex].dueDate !== newDateValue) {
                         if (!stateSaved) {
                             saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
                             stateSaved = true;
                         }
                        projectData.tasks[taskIndex].dueDate = newDateValue;
                        saveProjectsData();
                        dataChanged = true;
                     }
                    taskFound = true;
                    break;
                }
            }
        }
        if (!taskFound) {
            console.error("Task not found for due date edit:", taskId);
        }

        cleanup(); // Remove input, clear listeners

         // Update UI only if data actually changed (or if status might change due to overdue check)
         // It's safer to always re-render after date change as it affects overdue status display
        updateUIFromState(false); // Use the new UI update function
    };

     const cancelDateEdit = () => {
         cleanup(); // Just remove the input, no data change
     };

    // Handle Enter (save) and Escape (cancel)
    const handleDateKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            inputElement.blur(); // Trigger save via blur
        } else if (event.key === 'Escape') {
            cancelDateEdit();
        }
    };

    // Add listeners
    inputElement.addEventListener('blur', saveDateEdit); // Save on blur
    inputElement.addEventListener('change', saveDateEdit); // Save when date picker value changes
    inputElement.addEventListener('keydown', handleDateKeyDown);
}

/**
 * Iterates through all tasks and marks them as important if they are overdue and not already marked.
 * This is done as part of the regular UI update cycle now.
 * @returns {boolean} True if any task's importance was changed *during this check*, false otherwise.
 * Note: This doesn't save state for undo, as it's considered an automatic update.
 */
function checkAndMarkOverdueTasks() {
    let changesMade = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Compare dates only, ignore time

    for (const projName in projectsData.projects) {
        const projectData = projectsData.projects[projName];
        if (projectData && Array.isArray(projectData.tasks)) {
            projectData.tasks.forEach(task => {
                // Only check tasks that have a due date and are not already done, and the task object is valid
                if (task && task.dueDate && task.status !== 'done') {
                    const dueDate = new Date(task.dueDate + 'T00:00:00'); // Ensure correct date parsing
                    // If due date is before today and task is not already important
                    if (dueDate < today && !task.isImportant) {
                        task.isImportant = true; // Mark as important
                        changesMade = true;
                    }
                }
            });
        }
    }

    if (changesMade) {
        // console.log("Overdue tasks marked important. Saving data."); // Debug log
        // IMPORTANT: Don't save state for undo here - this is automatic
        saveProjectsData(); // Save data only if changes were made
    }
    return changesMade; // Return whether changes occurred
}

/**
 * Converts a subtask into a new, separate task in the same project.
 * @param {string|number} parentTaskId - The ID of the task containing the subtask.
 * @param {string|number} subtaskId - The ID of the subtask to convert.
 */
function convertSubtaskToTask(parentTaskId, subtaskId) {
    let parentTask = null;
    let subtaskIndex = -1;
    let parentProjectName = null;
    let subtaskData = null;

    // Find the parent task and the subtask within it
    for (const projName in projectsData.projects) {
        const projectData = projectsData.projects[projName];
        if (projectData && Array.isArray(projectData.tasks)) {
            parentTask = projectData.tasks.find(task => task && task.id == parentTaskId); // Add task check
            if (parentTask && Array.isArray(parentTask.subtasks)) {
                subtaskIndex = parentTask.subtasks.findIndex(st => st && st.id == subtaskId); // Add subtask check
                if (subtaskIndex !== -1) {
                    // Found the task and subtask
                    parentProjectName = projName; // Store the project name
                    subtaskData = parentTask.subtasks[subtaskIndex]; // Get the subtask data
                    break; // Exit the loop
                }
            }
        }
        parentTask = null; // Reset if subtask not found in this project's task
    }

    // Handle cases where the task or subtask wasn't found or is invalid
    if (!parentTask || subtaskIndex === -1 || !parentProjectName || !subtaskData || typeof subtaskData !== 'object' || typeof subtaskData.text !== 'string') {
        console.error("Could not find or validate parent task or subtask for conversion:", { parentTaskId, subtaskId });
        alert("Error: Could not find the subtask to convert."); // User feedback
        return;
    }

    saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE

    // Create the new task object based on the subtask
    const newTask = {
        id: generateUniqueId(), // Generate a new unique ID
        name: subtaskData.text, // Use subtask text as the new task name
        description: `Converted from subtask of "${parentTask.name}"`, // Add context to description
        status: 'backlog', // Default status for new tasks
        isImportant: false, // Default importance
        dueDate: null, // New tasks don't inherit due date by default
        subtasks: [] // New task starts with no subtasks
    };

    // Add the new task to the parent project's task list
     if (!Array.isArray(projectsData.projects[parentProjectName].tasks)) projectsData.projects[parentProjectName].tasks = []; // Ensure it's an array
    projectsData.projects[parentProjectName].tasks.push(newTask);

    // Remove the original subtask from the parent task
     // Ensure parentTask.subtasks is an array before splicing
     if (Array.isArray(parentTask.subtasks)) {
         parentTask.subtasks.splice(subtaskIndex, 1);
     } else {
          console.error("Parent task subtasks array missing during conversion cleanup:", parentTaskId);
     }


    saveProjectsData();
    updateUIFromState(false); // Re-render the board
}


/**
 * Adds a new subtask to a specified task and refocuses the input.
 * @param {string|number} taskId - The ID of the parent task.
 * @param {HTMLInputElement} inputElement - The input element containing the subtask text.
 */
function handleAddSubtask(taskId, inputElement) {
    const text = inputElement.value.trim();
    if (!text) return; // Do nothing if input is empty

    let taskFound = false;
    let stateSaved = false;

    // Find the parent task across all projects
    for (const projName in projectsData.projects) {
        const projectData = projectsData.projects[projName];
        if (projectData && Array.isArray(projectData.tasks)) {
            const taskIndex = projectData.tasks.findIndex(task => task && task.id == taskId); // Add task check
            if (taskIndex !== -1 && projectData.tasks[taskIndex]) { // Ensure task at index is valid
                if (!stateSaved) {
                    saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
                    stateSaved = true;
                }
                // Create the new subtask object
                const newSubtask = {
                    id: generateUniqueId(), // Unique ID
                    text: text,
                    completed: false // Default to not completed
                };
                // Ensure subtasks array exists
                if (!Array.isArray(projectData.tasks[taskIndex].subtasks)) {
                    projectData.tasks[taskIndex].subtasks = [];
                }
                projectData.tasks[taskIndex].subtasks.push(newSubtask);
                saveProjectsData();

                // Clear the input value *before* updating UI
                inputElement.value = '';

                taskFound = true;
                break; // Task found and updated
            }
        }
    }

    if (taskFound) {
        updateUIFromState(false); // Re-render to show the new subtask

        // Refocus the input field *after* re-rendering
        // Need to find the element again in the newly rendered DOM
        const targetTaskCardElement = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
         if (targetTaskCardElement) {
             const newInputElement = targetTaskCardElement.querySelector('.add-subtask-input');
             if (newInputElement) {
                 // Use setTimeout to ensure focus happens after browser rendering
                 setTimeout(() => newInputElement.focus(), 0);
             } else {
                 console.warn("Could not find new subtask input element to focus after render for task:", taskId);
             }
         }
    } else {
         console.error("Parent task not found for adding subtask:", taskId);
    }
}


/**
 * Toggles the visibility of the task details section.
 * Prevents toggling if the click originated from an interactive element within the header or details.
 * @param {Event} event - The click event object.
 */
function toggleDetails(event) {
    // Prevent toggle if click is on interactive elements like buttons, inputs, edit icons, etc.
    if (event.target.closest('input, button, textarea, select, .task-action-button, .task-due-date-edit-icon, .inline-edit-input, .inline-edit-textarea, .inline-edit-date, span[contenteditable="true"], .subtask-action-button')) {
        return; // Don't toggle if click was on an interactive element
    }

    const taskCard = event.currentTarget.closest('.task-card');
    if (!taskCard) return; // Should not happen if event listener is on header

    const taskDetails = taskCard.querySelector('.task-details');
    if (taskDetails) {
        taskDetails.classList.toggle('open'); // Toggle the 'open' class for CSS animation
    }
}

/**
 * Renders all tasks onto the Kanban board based on the current project view.
 * Clears existing tasks and re-populates columns.
 * Preserves the open/closed state of task details.
 */
function renderTasks() {
    let tasksToRender = [];
    const isAllProjectsView = (currentProjectName === ALL_PROJECTS_VIEW_KEY);

    // Show/hide "Add Task" buttons based on view
    addTaskColumnButtons.forEach(button => {
        button.style.display = isAllProjectsView ? 'none' : 'inline-flex'; // Use inline-flex for button with text
    });

    // Collect tasks based on the current view
    if (isAllProjectsView) {
        // Gather all important tasks from all non-archived projects
        for (const projectName in projectsData.projects) {
            const projectData = projectsData.projects[projectName];
            if (projectData && !projectData.isArchived && Array.isArray(projectData.tasks)) {
                const importantTasks = projectData.tasks
                    .filter(task => task && task.isImportant) // Add check for valid task object
                    .map(task => ({ ...task, originalProjectName: projectName })); // Add project name for context
                tasksToRender.push(...importantTasks);
            }
        }
        // For 'All Important', sort tasks by project name, then status, then importance, then name
         tasksToRender.sort((a, b) => {
             // Add checks for valid task objects a and b
             if (!a || !b) return 0;

             // Sort by project name
             const projectCompare = a.originalProjectName.localeCompare(b.originalProjectName);
             if (projectCompare !== 0) return projectCompare;

             // Sort by importance (important first)
             if (b.isImportant !== a.isImportant) return b.isImportant ? 1 : -1; // Important=true > Important=false

             // Sort by status (optional, maybe custom order?) - using default string sort for now
             // const statusOrder = { 'backlog': 0, 'todo': 1, 'inprogress': 2, 'done': 3 };
             // const statusCompare = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0); // Handle potentially invalid status gracefully
             // if (statusCompare !== 0) return statusCompare;

             // Sort by task name
             return (a.name || '').localeCompare(b.name || ''); // Handle potentially missing name
         });

    } else {
        // Get tasks from the currently selected project
        const projectData = projectsData.projects[currentProjectName];
        if (projectData && !projectData.isArchived && Array.isArray(projectData.tasks)) {
            // Filter tasks for the current project view's columns
            tasksToRender = projectData.tasks.filter(task => task && VALID_STATUSES.includes(task.status)); // Add task check
        } else if (!projectData) {
            console.warn(`Current project "${currentProjectName}" not found in data. Displaying empty board.`);
            tasksToRender = [];
        } else if (!Array.isArray(projectData?.tasks)) { // Check safely
            console.warn(`Tasks for project "${currentProjectName}" is not an array. Displaying empty board.`);
            tasksToRender = [];
            if(projectData) projectData.tasks = []; // Attempt to fix the data structure
         }
         // Tasks within a specific project/status are ordered by their appearance in the projectData.tasks array.
         // No explicit sorting needed here, drag/drop modifies the array order directly.
    }

    // --- Preserve Details Open State ---
    const openTaskIds = new Set();
    document.querySelectorAll('.task-details.open').forEach(details => {
        const card = details.closest('.task-card');
        if (card) {
            openTaskIds.add(card.getAttribute('data-task-id')); // Store IDs of open tasks
        }
    });

    // --- Clear and Re-populate Columns ---
    columns.forEach(column => {
        const taskList = column.querySelector('.task-list');
        if (taskList) {
            taskList.innerHTML = ''; // Clear previous tasks
        } else {
             console.error(`Could not find .task-list in column:`, column);
        }
    });

    tasksToRender.forEach(task => {
         // Additional check for task validity before rendering
         if (!task || typeof task !== 'object' || !task.status) {
             console.warn("Skipping rendering of invalid task:", task);
             return; // Skip this iteration if the task object is bad
         }

        const column = document.getElementById(task.status); // Find column by task status ID
        if (column) {
            // Create task element (pass project name if in 'All Important' view)
            const taskElement = createTaskElement(task, task.originalProjectName);

             if(taskElement) { // Only proceed if task element was successfully created
                 // Restore open state if it was open before re-render
                 if (openTaskIds.has(String(task.id))) {
                     const details = taskElement.querySelector('.task-details');
                     if (details) details.classList.add('open');
                 }

                 const taskList = column.querySelector('.task-list');
                 if (taskList) {
                     taskList.appendChild(taskElement); // Add task to the correct column
                 } else {
                     console.error(`Could not find .task-list to append task in column:`, column);
                 }
             } // Else task element creation failed, skip appending
        } else {
            // Handle tasks with invalid status (attempt to fix and re-render)
            console.warn(`Task status "${task.status}" invalid or column not found. Attempting to correct for task ID: ${task.id}`);
            // This only applies to specific project views, not All Important
             if (currentProjectName !== ALL_PROJECTS_VIEW_KEY && projectsData.projects[currentProjectName]) {
                const projectData = projectsData.projects[currentProjectName];
                if (projectData && Array.isArray(projectData.tasks)) {
                     const taskIndex = projectData.tasks.findIndex(t => t && t.id == task.id); // Use == for type leniency; Add task check
                     if (taskIndex !== -1 && projectData.tasks[taskIndex]) { // Ensure task at index is valid
                         // Save state *before* correcting the status automatically
                         // Debatable if automatic corrections should be undoable, let's make them NOT undoable for simplicity
                         // saveStateForUndo();
                         projectData.tasks[taskIndex].status = 'backlog'; // Reset to backlog
                         console.log(`Corrected status for task ${task.id} to 'backlog' in project "${currentProjectName}".`);
                         saveProjectsData(); // Save the correction
                         updateUIFromState(false); // Trigger re-render after correction (without new undo state)
                         return; // Stop processing this task in the current loop to avoid infinite loops if fix fails
                     }
                }
            } else {
                 // If in 'All Important' view or project not found, we can't reliably correct status in the data.
                 console.error(`Cannot find project data or not in specific project view to correct task status for task ID: ${task.id}`);
            }
        }
    });
}

/**
 * Adds a new task based on the data entered in the task modal.
 * Validates input and adds the task to the current project.
 * @returns {boolean} True if the task was added successfully, false otherwise.
 */
function addTaskFromModal() {
    const taskName = modalTaskNameInput.value.trim();
    const taskDesc = modalTaskDescInput.value.trim();
    const taskDueDate = modalTaskDueDateInput.value || null; // Store as null if empty

    // Validate task name
    if (taskName === '') {
        modalAddTaskError.textContent = 'Please enter a task name.';
        modalAddTaskError.classList.remove('hidden');
        modalTaskNameInput.focus();
        return false; // Indicate failure
    }
    modalAddTaskError.classList.add('hidden'); // Clear error message

    // Determine target project (cannot add to "All Important" view)
    const targetProjectName = currentProjectName === ALL_PROJECTS_VIEW_KEY ? null : currentProjectName;
    if (!targetProjectName || !projectsData.projects[targetProjectName]) {
        console.error("Cannot add task directly to 'All Important Tasks' view or project not found.", targetProjectName);
        alert("Error: Cannot add tasks to this view or selected project not found.");
        return false; // Indicate failure
    }

    // Create new task object
    const newTask = {
        id: generateUniqueId(), // Unique ID
        name: taskName,
        description: taskDesc,
        status: targetStatusForTaskAdd, // Status determined when modal opened
        isImportant: false, // Default importance
        dueDate: taskDueDate,
        subtasks: [] // Start with empty subtasks
    };

    // Add task to the project's data
    const projectData = projectsData.projects[targetProjectName];
     // Safety check already done above, but keep array check
    if (!Array.isArray(projectData.tasks)) {
         console.error("Target project tasks structure invalid:", targetProjectName);
         projectData.tasks = []; // Attempt to fix
    }

    saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
    projectData.tasks.push(newTask);

    saveProjectsData();
    updateUIFromState(false); // Update the board using unified function
    return true; // Indicate success
}

/**
 * Helper function to add a subtask programmatically (e.g., for future features).
 * @param {string|number} taskId - The ID of the parent task.
 * @param {string} subtaskText - The text for the new subtask.
 */
function addSubtask(taskId, subtaskText) {
    // Simulate input element for handleAddSubtask function
    handleAddSubtask(taskId, { value: subtaskText, _is_direct_call: true });
}

/**
 * Toggles the completion status of a subtask.
 * @param {string|number} taskId - The ID of the parent task.
 * @param {string|number} subtaskId - The ID of the subtask to toggle.
 */
function toggleSubtaskCompletion(taskId, subtaskId) {
    let taskFound = false;
    let taskInstance = null;
    let stateSaved = false;
    // Find the parent task and subtask
    for (const projName in projectsData.projects) {
        const projectData = projectsData.projects[projName];
        if (projectData && Array.isArray(projectData.tasks)) {
            const taskIndex = projectData.tasks.findIndex(task => task && task.id == taskId); // Add task check
            if (taskIndex !== -1 && projectData.tasks[taskIndex]) { // Ensure task at index is valid
                taskInstance = projectData.tasks[taskIndex];
                if (Array.isArray(taskInstance.subtasks)) { // Ensure subtasks is an array
                     const subtaskIndex = taskInstance.subtasks.findIndex(st => st && st.id == subtaskId); // Add subtask check
                     if (subtaskIndex !== -1 && taskInstance.subtasks[subtaskIndex]) { // Ensure subtask at index is valid
                         if (!stateSaved) {
                             saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE
                             stateSaved = true;
                         }
                         // Toggle the completed status
                         taskInstance.subtasks[subtaskIndex].completed = !taskInstance.subtasks[subtaskIndex].completed;
                         taskFound = true;
                         break; // Subtask found and updated
                     } else {
                         console.error("Subtask not found or invalid:", subtaskId);
                         return; // Exit if subtask ID is wrong or invalid
                     }
                } else {
                     console.error("Parent task subtasks array missing or invalid:", taskId);
                     return; // Exit if subtasks array is invalid
                }
            }
        }
    }

    if (taskFound) {
        saveProjectsData();
        updateUIFromState(false); // Re-render using unified function
    } else {
        console.error("Parent task missing or invalid:", taskId);
    }
}

/**
 * Triggers a confetti animation, typically used when a task is moved to "Done".
 */
function triggerConfetti() {
    // Use the canvas-confetti library if available
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150, // More particles
            spread: 90, // Wider spread
            origin: { y: 0.6 }, // Start slightly below center
            zIndex: 10000, // Ensure confetti is on top
            colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42'] // Custom colors
        });
    }
}

// --- Modal Handling ---

/**
 * Opens the "Add Task" modal and sets the target status for the new task.
 * @param {string} targetStatus - The status ('backlog', 'todo', etc.) the new task should have.
 */
function openTaskModal(targetStatus) {
    if (!VALID_STATUSES.includes(targetStatus)) {
         console.error("Invalid target status for opening modal:", targetStatus);
         return;
    }
     // Prevent adding tasks if in the 'All Important' view
     if (currentProjectName === ALL_PROJECTS_VIEW_KEY) {
          alert("Cannot add tasks directly to the 'All Important Tasks' view. Please select a specific project first.");
          return;
     }
    targetStatusForTaskAdd = targetStatus; // Store the target status
    // Reset modal fields
    modalTaskNameInput.value = '';
    modalTaskDescInput.value = '';
    modalTaskDueDateInput.value = '';
    modalAddTaskError.classList.add('hidden'); // Hide error message
    addTaskModal.classList.add('open'); // Show modal (triggers CSS animation)
    setTimeout(() => modalTaskNameInput.focus(), 50); // Focus name input shortly after opening
}

/** Closes the "Add Task" modal. */
function closeTaskModal() {
    addTaskModal.classList.remove('open'); // Hide modal (triggers CSS animation)
}

/** Opens the "Add Project" modal. */
function openProjectModal() {
    modalProjectNameInput.value = ''; // Reset field
    modalAddProjectError.classList.add('hidden'); // Hide error
    addProjectModal.classList.add('open'); // Show modal
    setTimeout(() => modalProjectNameInput.focus(), 50); // Focus input
}

/** Closes the "Add Project" modal. */
function closeProjectModal() {
    addProjectModal.classList.remove('open'); // Hide modal
}

/** Opens the "Settings" modal. */
function openSettingsModal() {
    settingsModal.classList.add('open'); // Show modal
}

/** Closes the "Settings" modal. */
function closeSettingsModal() {
    settingsModal.classList.remove('open'); // Hide modal
}

// --- Data Import/Export ---

/** Exports the current projectsData to a JSON file. */
function exportData() {
    try {
        const dataStr = JSON.stringify(projectsData, null, 2); // Pretty print JSON
        const dataBlob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        // Create a timestamped filename
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
        link.download = `abhay-task-manager-data-${timestamp}.json`;
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up blob URL
    } catch (error) {
        console.error("Error exporting data:", error);
        alert("Error exporting data. See console for details.");
    }
}

/** Triggers the hidden file input for importing data. */
function triggerImport() {
    importFileInput.click(); // Open file selection dialog
}

/**
 * Handles the file import process after a file is selected.
 * Reads the JSON file, validates it, and replaces the current data.
 * @param {Event} event - The change event from the file input.
 */
function importData(event) {
    const file = event.target.files[0];
    if (!file) { return; } // No file selected

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const rawImportedData = JSON.parse(e.target.result);

            // Validate and clean the imported data
            const validatedData = validateAndCleanDataStructure(rawImportedData);

            if (validatedData)
            {
                // Replace current data with validated data
                projectsData = validatedData;
                currentProjectName = projectsData.currentProject; // Use the validated current project

                clearUndoHistory(); // <<< Clear history after successful import
                saveProjectsData(); // Save the newly imported and validated data state

                // UI Update is handled implicitly by the state change and loadProjectsData flow
                updateUIFromState(false); // Explicitly update UI based on loaded state

                alert("Data imported successfully!"); // User feedback
                closeSettingsModal(); // Close settings after import
            } else {
                 // validateAndCleanDataStructure already logged error
                 alert("Error importing data: Invalid data structure or format."); // User feedback
            }
        } catch (error) {
            console.error("Error processing imported data:", error);
            alert(`Error processing imported data: ${error.message}. Please ensure the file is valid JSON.`);
        } finally {
            importFileInput.value = ''; // Reset file input
        }
    };
    reader.onerror = function() {
        alert("Error reading file.");
        importFileInput.value = ''; // Reset file input
    };
    reader.readAsText(file); // Read the file content
}

// --- Drag and Drop Handlers ---

/**
 * Finds a task by ID across all projects.
 * @param {string|number} taskId - The ID of the task.
 * @returns {{task: object, project: string, index: number}|null} Object containing the task, project name, and index, or null if not found.
 */
function findTaskById(taskId) {
     for (const projName in projectsData.projects) {
         const projectData = projectsData.projects[projName];
         if (projectData && Array.isArray(projectData.tasks)) {
             const taskIndex = projectData.tasks.findIndex(task => task && task.id == taskId); // Add check for valid task object
             if (taskIndex !== -1 && projectData.tasks[taskIndex]) { // Ensure task at index is valid
                 return {
                     task: projectData.tasks[taskIndex],
                     project: projName,
                     index: taskIndex
                 };
             }
         }
     }
     return null; // Task not found
}

/** Handles the start of dragging a task card. */
function handleTaskDragStart(event) {
     // Prevent drag if initiated on interactive elements inside details
     if (event.target.closest('.task-details') && event.target.matches('input, button, textarea, select, span[contenteditable="true"], i')) {
         event.preventDefault();
         return;
     }
    const taskCard = event.currentTarget;
    const taskId = taskCard.getAttribute('data-task-id');
     const taskStatus = taskCard.getAttribute('data-task-status'); // Store status
    // Store the project name the task belongs to, needed for 'All Important' view drag/drop
    const originalProjectName = taskCard.getAttribute('data-project-name') || currentProjectName;

    event.dataTransfer.setData(DATA_TYPE, DRAG_TYPE_TASK); // Indicate dragging a task
    event.dataTransfer.setData(TASK_ID, taskId); // Store task ID
     event.dataTransfer.setData('text/taskStatus', taskStatus); // Store task status
     event.dataTransfer.setData('text/originalProjectName', originalProjectName); // Store original project

    event.dataTransfer.effectAllowed = 'move'; // Indicate move operation
    // Add dragging class slightly later for smoother visual transition
    setTimeout(() => taskCard.classList.add('dragging'), 0);

    // Clean up any lingering drag-over indicators immediately from columns and tasks
     columns.forEach(col => col.classList.remove('drag-over'));
     document.querySelectorAll('.task-card.drag-over-item-top, .task-card.drag-over-item-bottom').forEach(card => {
          card.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
     });
}

/** Handles the end of dragging a task card (cleanup). */
function handleTaskDragEnd(event) {
    // Remove dragging class from the element that was dragged
    const draggedElement = document.querySelector('.task-card.dragging');
    if (draggedElement) {
         draggedElement.classList.remove('dragging');
    }
    // Remove visual feedback from all columns and tasks
    columns.forEach(column => column.classList.remove('drag-over'));
     document.querySelectorAll('.task-card.drag-over-item-top, .task-card.drag-over-item-bottom').forEach(card => {
          card.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
     });
}

/** Handles the start of dragging a subtask item. */
function handleSubtaskDragStart(event) {
    event.stopPropagation(); // Prevent task card drag start
    const subtaskItem = event.currentTarget;
    const subtaskId = subtaskItem.getAttribute('data-subtask-id');
    const sourceTaskId = subtaskItem.getAttribute('data-parent-task-id');
    event.dataTransfer.setData(DATA_TYPE, DRAG_TYPE_SUBTASK); // Indicate dragging a subtask
    event.dataTransfer.setData(SUBTASK_ID, subtaskId);
    event.dataTransfer.setData(SOURCE_TASK_ID, sourceTaskId);
    event.dataTransfer.effectAllowed = 'move';
    setTimeout(() => subtaskItem.classList.add('subtask-dragging'), 0); // Add visual style

     // Clean up any lingering subtask drag-over indicators
     document.querySelectorAll('.subtask-item.drag-over-item-top, .subtask-item.drag-over-item-bottom').forEach(item => {
          item.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
     });
}

/** Handles the end of dragging a subtask item (cleanup). */
function handleSubtaskDragEnd(event) {
    event.stopPropagation();
    // Remove dragging style from the subtask
    const draggedElement = document.querySelector('.subtask-item.subtask-dragging');
    if (draggedElement) {
         draggedElement.classList.remove('subtask-dragging');
    }
    // Remove visual feedback from potential subtask drop targets
    document.querySelectorAll('.subtask-item.drag-over-item-top, .subtask-item.drag-over-item-bottom').forEach(item => {
          item.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
     });
     // Also clean up task card indicators, as a subtask might have been dragged over one
     document.querySelectorAll('.task-card.drag-over-item-top, .task-card.drag-over-item-bottom').forEach(card => {
          card.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
     });
}

/** Handles dragging over a Kanban column (potential drop target for tasks). */
function handleColumnDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    const dragType = event.dataTransfer.getData(DATA_TYPE);
    const targetColumn = event.currentTarget;
    const targetStatus = targetColumn.getAttribute('data-status');
     const draggedTaskStatus = event.dataTransfer.getData('text/taskStatus'); // Status of the task being dragged

    // Only allow dropping tasks (not subtasks or sidebar items) directly onto columns
    if (dragType === DRAG_TYPE_TASK) {
         // If in 'All Important' view, cannot drop tasks to change status
         if (currentProjectName === ALL_PROJECTS_VIEW_KEY) {
             event.dataTransfer.dropEffect = 'none';
             return;
         }

        event.dataTransfer.dropEffect = 'move';

         // If dropping onto the *same* column, let the task card dragover handler take over
         if (draggedTaskStatus === targetStatus) {
              targetColumn.classList.remove('drag-over'); // Remove column highlight
              return; // Let event bubble/continue to task card handlers
         }

        // Add visual feedback class if not already present
        if (!targetColumn.classList.contains('drag-over')) {
            // Remove from other columns first
            columns.forEach(col => col.classList.remove('drag-over'));
            // Remove task indicators if dragging over column space after hovering a task
             document.querySelectorAll('.task-card.drag-over-item-top, .task-card.drag-over-item-bottom').forEach(card => {
                  card.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
             });
            targetColumn.classList.add('drag-over');
        }
    } else {
        event.dataTransfer.dropEffect = 'none'; // Disallow dropping other types
    }
}

/** Handles dragging leaving a Kanban column (remove visual feedback). */
function handleColumnDragLeave(event) {
    // Avoid removing class if moving between elements within the column
    if (event.currentTarget.contains(event.relatedTarget)) return;
    event.currentTarget.classList.remove('drag-over');
}

/** Handles dropping a task onto a Kanban column (empty space or bottom). */
function handleColumnDrop(event) {
    event.preventDefault(); // Prevent default browser action
    const column = event.currentTarget;
    column.classList.remove('drag-over'); // Remove visual feedback

    const dragType = event.dataTransfer.getData(DATA_TYPE);
    const taskIdToMove = event.dataTransfer.getData(TASK_ID);
    const newStatus = column.getAttribute('data-status'); // Get status from column ID
     const taskOriginalProject = event.dataTransfer.getData('text/originalProjectName') || currentProjectName; // Get original project

    // Check if it's a valid task drop, not in 'All Important' view, and dropped onto the column *itself* (or empty space)
     // Dropping onto a task card within the column is handled by handleTaskDrop
    if (dragType === DRAG_TYPE_TASK && taskIdToMove && newStatus && VALID_STATUSES.includes(newStatus) && currentProjectName !== ALL_PROJECTS_VIEW_KEY) {

         // Ensure the drop target is the column itself or the empty task-list div, not a task card
         // If event.target is a task card, let handleTaskDrop handle it.
         if (event.target.closest('.task-card')) {
             // This drop is likely happening *on* a task, even if the column border is highlighted.
             // The task drop handler will remove the border and handle the drop.
             return;
         }
         // If dropped directly on the empty task-list or column header/footer
         const droppedOntoTaskList = event.target.classList.contains('task-list');
         const droppedOntoColumn = event.target.classList.contains('kanban-column');
         const droppedOntoAddButtonArea = event.target.closest('.add-task-button-container');

         if (droppedOntoTaskList || droppedOntoColumn || droppedOntoAddButtonArea) {

             // Find the task in the data
             const taskInfo = findTaskById(taskIdToMove);

             if (!taskInfo || taskInfo.project !== currentProjectName) {
                  // Task not found in current project or drag was from another project (not supported for tasks yet)
                 console.warn("Dropped task not found in current project or cross-project drag detected:", {taskIdToMove, currentProjectName, taskInfo});
                 return;
             }

             const task = taskInfo.task;
             const originalIndex = taskInfo.index;
             const oldStatus = task.status;

             // Only proceed if status is changing or it's a reorder within the same column
             if (oldStatus !== newStatus || droppedOntoTaskList) { // droppedOntoTaskList means dropped into empty space, potentially reordering
                 saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE

                 // Remove the task from its current position in the tasks array
                  // Ensure projectData.tasks is an array before splicing
                  if (!Array.isArray(projectsData.projects[currentProjectName].tasks)) {
                      console.error("Project tasks array missing during column drop:", currentProjectName);
                      return;
                  }
                 const movedTask = projectsData.projects[currentProjectName].tasks.splice(originalIndex, 1)[0];

                 // Update its status if changing
                 movedTask.status = newStatus;

                 // Add the task to the end of the tasks array.
                 // The renderTasks function will then place it in the correct column.
                 // Reordering within a column (when dropped on empty list) means placing it at the end.
                 projectsData.projects[currentProjectName].tasks.push(movedTask);

                 // Trigger confetti if moved to 'Done'
                 if (newStatus === 'done' && oldStatus !== 'done') {
                     triggerConfetti();
                 }

                 saveProjectsData();
                 updateUIFromState(false); // Re-render the board using unified function
             }
         }
    }
}

/**
 * Handles dragging over a task card or subtask item (potential drop target for tasks/subtasks).
 * Adds visual indicators for insertion point.
 */
function handleTaskDragOver(event) {
    event.preventDefault(); // Allow drop
    event.stopPropagation(); // Prevent column dragover

    const dragType = event.dataTransfer.getData(DATA_TYPE);
    const targetElement = event.currentTarget; // This is the task card or subtask item being hovered over

    // Remove any existing drag-over indicators from tasks and subtasks in the current view
    document.querySelectorAll('.task-card.drag-over-item-top, .task-card.drag-over-item-bottom').forEach(card => {
         card.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
    });
    document.querySelectorAll('.subtask-item.drag-over-item-top, .subtask-item.drag-over-item-bottom').forEach(item => {
         item.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
    });
     // Also remove column drag-over just in case
    columns.forEach(col => col.classList.remove('drag-over'));


    const rect = targetElement.getBoundingClientRect();
    const isDroppedBefore = event.clientY < rect.top + rect.height / 2; // Determine if above or below midpoint

    if (dragType === DRAG_TYPE_TASK) {
        const draggedTaskId = event.dataTransfer.getData(TASK_ID);
         const draggedTaskStatus = event.dataTransfer.getData('text/taskStatus');
         const targetTaskStatus = targetElement.getAttribute('data-task-status');

         // Only add indicator if dropping a task onto another task *within the same column*
         if (draggedTaskStatus === targetTaskStatus) {
             event.dataTransfer.dropEffect = 'move'; // Allow move
             if (isDroppedBefore) {
                 targetElement.classList.add('drag-over-item-top');
             } else {
                 targetElement.classList.add('drag-over-item-bottom');
             }
         } else {
             // If dropping a task onto a task in a *different* column, disallow the drop *on the task*
             // Let the column handler potentially handle it (though cross-column task-on-task drop isn't explicitly handled)
              event.dataTransfer.dropEffect = 'none'; // Prevent task-on-task drop across columns
         }

    } else if (dragType === DRAG_TYPE_SUBTASK) {
         const draggedSubtaskId = event.dataTransfer.getData(SUBTASK_ID);
         const sourceTaskId = event.dataTransfer.getData(SOURCE_TASK_ID);
         const targetTaskId = targetElement.getAttribute('data-task-id') || targetElement.getAttribute('data-parent-task-id'); // Target can be a task card or another subtask

        // If target is a subtask item, check if it's within the *same* parent task as the one being dragged
         if (targetElement.classList.contains('subtask-item')) {
              const targetParentTaskId = targetElement.getAttribute('data-parent-task-id');
              if (sourceTaskId === targetParentTaskId) { // Reordering within the same parent task
                   event.dataTransfer.dropEffect = 'move'; // Allow move
                   if (isDroppedBefore) {
                       targetElement.classList.add('drag-over-item-top');
                   } else {
                       targetElement.classList.add('drag-over-item-bottom');
                   }
              } else {
                   // Dropping subtask onto a subtask in a *different* parent task
                   event.dataTransfer.dropEffect = 'none'; // Prevent subtask-on-subtask drop across tasks
              }
         } else if (targetElement.classList.contains('task-card')) {
              // Dropping a subtask onto a task card (either its own parent or a different one)
              event.dataTransfer.dropEffect = 'move'; // Allow move (this will be handled by handleTaskDrop)
              // No specific top/bottom indicator needed on the task card itself for subtask drop
         }


    } else {
        // Disallow other drag types
        event.dataTransfer.dropEffect = 'none';
    }
}

/** Handles dragging leaving a task card or subtask item (remove indicator). */
function handleTaskDragLeave(event) {
     const targetElement = event.currentTarget;
     const related = event.relatedTarget;

     // If leaving the target element but entering a child element (e.g., moving cursor within the task card/subtask), do nothing.
     if (targetElement.contains(related)) {
         return;
     }

     // If relatedTarget is null or outside the document, remove indicators.
     // Otherwise, dragover on the new element will handle adding a new indicator.
     if (!related || !document.documentElement.contains(related)) {
        targetElement.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
        // Also clean up column indicator if necessary (should be handled by column leave)
        // columns.forEach(col => col.classList.remove('drag-over'));
     }
}


/** Handles dropping a task or subtask onto a task card or subtask item. */
function handleTaskDrop(event) {
    event.preventDefault(); // Prevent default action
    event.stopPropagation(); // Prevent column drop

    const dragType = event.dataTransfer.getData(DATA_TYPE);
    const targetElement = event.currentTarget; // The task card or subtask item the drop occurred on

    // Remove all drag-over indicators
     document.querySelectorAll('.task-card.drag-over-item-top, .task-card.drag-over-item-bottom').forEach(card => {
          card.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
     });
     document.querySelectorAll('.subtask-item.drag-over-item-top, .subtask-item.drag-over-item-bottom').forEach(item => {
          item.classList.remove('drag-over-item-top', 'drag-over-item-bottom');
     });


    const rect = targetElement.getBoundingClientRect();
    const isDroppedBefore = event.clientY < rect.top + rect.height / 2; // Determine if drop was above or below midpoint


    if (dragType === DRAG_TYPE_TASK) {
        const draggedTaskId = event.dataTransfer.getData(TASK_ID);
        const draggedTaskStatus = event.dataTransfer.getData('text/taskStatus');
        const targetTaskId = targetElement.getAttribute('data-task-id');
        const targetTaskStatus = targetElement.getAttribute('data-task-status');
         const taskOriginalProject = event.dataTransfer.getData('text/originalProjectName') || currentProjectName; // Get original project

         // Ensure drop is within the same project view (cross-project task drag/drop is not supported)
         if (currentProjectName === ALL_PROJECTS_VIEW_KEY || taskOriginalProject !== currentProjectName) {
             console.warn("Task drop ignored: Cross-project drag or drag in 'All Important' view not supported.");
             return;
         }

         // Find the source and target tasks in the data
         const sourceTaskInfo = findTaskById(draggedTaskId);
         const targetTaskInfo = findTaskById(targetTaskId);

         if (!sourceTaskInfo || !targetTaskInfo || !sourceTaskInfo.task || !targetTaskInfo.task) { // Add task object validity check
             console.error("Source or target task not found or invalid in data for task drop:", { draggedTaskId, targetTaskId });
             return;
         }

         // Ensure they are in the same project (already checked above, but double-check)
         if (sourceTaskInfo.project !== currentProjectName || targetTaskInfo.project !== currentProjectName) {
              console.error("Task drop ignored: Tasks not in the expected current project.");
              return;
         }


         // --- Task Reordering Logic ---
         // This handles dropping a task onto another task.
         // Status change *must* happen via dropping onto the column area, not a task card.
         // Therefore, this logic only handles reordering *within* the same status column.
         if (sourceTaskInfo.task.status === targetTaskInfo.task.status) {
             // If dropped onto itself, do nothing
             if (draggedTaskId === targetTaskId) {
                 return;
             }

             saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE

             const projectTasks = projectsData.projects[currentProjectName].tasks;

             // Find the index of the dragged task in the full project tasks array
             const originalIndex = projectTasks.findIndex(task => task && task.id == draggedTaskId); // Add task check
             // Find the index of the target task in the full project tasks array
             const targetIndex = projectTasks.findIndex(task => task && task.id == targetTaskId); // Add task check

             if (originalIndex !== -1 && targetIndex !== -1) {
                 // Remove the dragged task from its original position
                  // Ensure projectTasks is an array before splicing
                  if (!Array.isArray(projectTasks)) {
                      console.error("Project tasks array missing during task drop reorder:", currentProjectName);
                      return;
                  }
                 const [movedTask] = projectTasks.splice(originalIndex, 1);

                 // Determine the insertion index
                 let insertIndex = targetIndex;

                 // If the original index was before the target index, removing it shifted
                 // subsequent items left by 1, so the effective insert index is one less.
                 if (originalIndex < targetIndex) {
                     insertIndex--;
                 }

                 // If dropped below the target, insert after the target's new position
                 if (!isDroppedBefore) {
                      insertIndex++;
                 }

                  // Ensure the insert index is within bounds
                  insertIndex = Math.max(0, Math.min(projectTasks.length, insertIndex));


                 // Insert the dragged task at the calculated index
                 projectTasks.splice(insertIndex, 0, movedTask);

                 saveProjectsData();
                 updateUIFromState(false); // Re-render to show the new order
             } else {
                 console.error("Error finding task indices during drop reorder:", { draggedTaskId, targetTaskId, originalIndex, targetIndex });
             }

         } else {
             // This case means a task was dragged from one column and dropped onto a task in *another* column.
             // This interaction is not explicitly supported by the UI/logic. Dropping onto the column area is the intended way to change status.
             console.warn(`Task drop ignored: Dropped task from status "${draggedTaskStatus}" onto task in status "${targetTaskStatus}". Status change must be done by dropping onto the column background.`);
             // Optionally alert the user or provide feedback
             // alert("To change a task's status, drag it to the column header or empty space.");
         }


    } else if (dragType === DRAG_TYPE_SUBTASK) {
         const draggedSubtaskId = event.dataTransfer.getData(SUBTASK_ID);
         const sourceTaskId = event.dataTransfer.getData(SOURCE_TASK_ID);
         // Target can be a task card or another subtask item
         const targetTaskId = targetElement.getAttribute('data-task-id'); // If target is a task card
         const targetSubtaskId = targetElement.getAttribute('data-subtask-id'); // If target is a subtask item
         const targetParentTaskId = targetElement.getAttribute('data-parent-task-id'); // If target is a subtask item

         // Find the source task and target task in the data
         const sourceTaskInfo = findTaskById(sourceTaskId);
         // If target is a subtask, the target *parent* task is the target task
         // If target is a task card, the target *task* is the target task
         const targetTaskInfo = findTaskById(targetTaskId || targetParentTaskId);


         if (!sourceTaskInfo || !targetTaskInfo || !sourceTaskInfo.task || !targetTaskInfo.task) { // Add task object validity check
              console.error("Source or target task not found or invalid in data for subtask drop:", { sourceTaskId, targetTaskId, targetParentTaskId });
              return;
         }

         // Ensure tasks are in the same project view
          if (sourceTaskInfo.project !== currentProjectName || targetTaskInfo.project !== currentProjectName) {
              console.warn("Subtask drop ignored: Tasks not in the expected current project.");
              return;
         }

        const sourceTask = sourceTaskInfo.task;
        const targetTask = targetTaskInfo.task;

         // Ensure subtasks arrays are valid before proceeding
         if (!Array.isArray(sourceTask.subtasks)) {
              console.error("Source task subtasks array missing or invalid during subtask drop:", sourceTaskId);
              return;
         }
         if (!Array.isArray(targetTask.subtasks)) {
             console.warn("Target task subtasks array missing or invalid during subtask drop. Attempting to create.", targetTask.id);
             targetTask.subtasks = []; // Attempt to fix
         }


        const sourceSubtaskIndex = sourceTask.subtasks.findIndex(st => st && st.id == draggedSubtaskId); // Add subtask check


        if (sourceSubtaskIndex !== -1 && sourceTask.subtasks[sourceSubtaskIndex]) { // Ensure source subtask was found and is valid
             saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE

             const movedSubtask = sourceTask.subtasks[sourceSubtaskIndex];

            if (sourceTaskId === targetTask.id) {
                // --- Reordering within the same task's subtasks ---
                // Find the index within the target task's subtasks array (which is the source task)
                let targetSubtaskIndex = -1;
                if (targetSubtaskId) { // If dropped onto a specific subtask
                     targetSubtaskIndex = targetTask.subtasks.findIndex(st => st && st.id == targetSubtaskId); // Add subtask check
                } else { // If dropped onto the task card background/empty subtask area
                     // Default to adding to the end of the subtasks list
                     targetSubtaskIndex = targetTask.subtasks.length;
                }


                if (targetSubtaskIndex !== -1) { // Target index found (or is end of list)
                     // Remove the subtask from its original position
                     sourceTask.subtasks.splice(sourceSubtaskIndex, 1);

                    // Determine the insertion index in the *modified* array
                    let insertIndex = targetSubtaskIndex;
                     // If the original index was before the target index in the original list,
                     // removing it shifts subsequent items left, so the effective insertion index is one less.
                     if (sourceSubtaskIndex < targetSubtaskIndex) {
                         insertIndex--;
                    }

                     // If dropped below the target, insert after the target's new position
                     // This adjustment is only needed if dropping ONTO an existing subtask element
                     if (targetSubtaskId && !isDroppedBefore) {
                          insertIndex++;
                     }
                     // If dropped onto the task card (targetSubtaskId is null), insertIndex was already set to length (end)

                     // Ensure the insert index is within bounds
                     insertIndex = Math.max(0, Math.min(targetTask.subtasks.length, insertIndex));


                     // Insert the moved subtask into the target task's subtasks array
                     targetTask.subtasks.splice(insertIndex, 0, movedSubtask);

                } else {
                     // This case implies dropping onto the task card background, but targetSubtaskId lookup somehow failed.
                     // Fallback: add to the end.
                     console.warn("Target subtask not found for reorder, falling back to adding to end:", targetSubtaskId);
                     sourceTask.subtasks.splice(sourceSubtaskIndex, 1); // Remove from source
                     targetTask.subtasks.push(movedSubtask); // Add to end of target
                }


            } else {
                // --- Moving subtask to a different task's subtasks ---
                 // Ensure target task has a subtasks array (checked above, but defensive)
                 if (!Array.isArray(targetTask.subtasks)) { targetTask.subtasks = []; }

                 // Remove from source task's subtasks
                 sourceTask.subtasks.splice(sourceSubtaskIndex, 1);

                // Add to target task's subtasks. Default to end of list for cross-task moves.
                targetTask.subtasks.push(movedSubtask);
            }

            saveProjectsData();
            updateUIFromState(false); // Re-render the relevant task cards
        } else {
            console.error("Dragged subtask not found or invalid in source task:", draggedSubtaskId);
        }
    }
    // Ignore drops of other types
}


/** Handles the start of dragging a project sidebar item. */
function handleProjectDragStart(event) {
    const listItem = event.currentTarget;
    const projectKey = listItem.getAttribute('data-project-key');
    const isPinned = listItem.getAttribute('data-is-pinned') === 'true';

    if (!projectKey || listItem.classList.contains('static-item')) {
         event.preventDefault(); // Prevent drag if no key or it's a static item
         return;
    }

     // Close any active inline edits before dragging
     if (activeInlineEditInput) activeInlineEditInput.blur();
     if (activeInlineDateInput) activeInlineDateInput.blur();

    event.dataTransfer.setData(DATA_TYPE, DRAG_TYPE_PROJECT_SIDEBAR);
    event.dataTransfer.setData('text/projectKey', projectKey);
     event.dataTransfer.setData('text/isPinned', isPinned ? 'true' : 'false'); // Store pin status of dragged item

    event.dataTransfer.effectAllowed = 'move';
    // Add dragging class slightly later for smoother visual transition
    setTimeout(() => listItem.classList.add('sidebar-dragging'), 0);

    // Clean up existing drag-over indicators immediately
     document.querySelectorAll('.project-list-item.drag-over-indicator, .project-list-item.drag-over-indicator-bottom').forEach(el => {
         el.classList.remove('drag-over-indicator', 'drag-over-indicator-bottom');
     });
}

/** Handles the end of dragging a project sidebar item (cleanup). */
function handleProjectDragEnd(event) {
    // Remove dragging class
    const draggedElement = document.querySelector('.project-list-item.sidebar-dragging');
    if (draggedElement) {
         draggedElement.classList.remove('sidebar-dragging');
    }
    // Remove all drag-over indicators
     document.querySelectorAll('.project-list-item.drag-over-indicator, .project-list-item.drag-over-indicator-bottom').forEach(el => {
         el.classList.remove('drag-over-indicator', 'drag-over-indicator-bottom');
     });
}

/** Handles dragging over a project sidebar item (potential drop target). */
function handleProjectDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    const dragType = event.dataTransfer.getData(DATA_TYPE);
    const targetItem = event.currentTarget;

    // Only handle drops of project sidebar items onto draggable project sidebar items
    if (dragType === DRAG_TYPE_PROJECT_SIDEBAR && targetItem.getAttribute('draggable') === 'true') {
         event.dataTransfer.dropEffect = 'move'; // Allow move

         // Get dragged item's pin status
         const draggedIsPinned = event.dataTransfer.getData('text/isPinned') === 'true';
         // Get target item's pin status
         const targetIsPinned = targetItem.getAttribute('data-is-pinned') === 'true';

         // Prevent dropping a pinned item into the unpinned section or vice-versa
         if (draggedIsPinned !== targetIsPinned) {
             event.dataTransfer.dropEffect = 'none'; // Disallow drop
             return; // Exit early
         }

         // Remove any existing drag-over indicators
        projectListElement.querySelectorAll('.drag-over-indicator, .drag-over-indicator-bottom').forEach(el => {
             el.classList.remove('drag-over-indicator', 'drag-over-indicator-bottom');
        });

        // Determine drop position relative to the target item
        const rect = targetItem.getBoundingClientRect();
        const isDroppedBefore = event.clientY < rect.top + rect.height / 2;

        // Add visual indicator
        if (isDroppedBefore) {
            targetItem.classList.add('drag-over-indicator');
        } else {
             targetItem.classList.add('drag-over-indicator-bottom'); // Indicates dropping *after* this item
        }

    } else {
        // Not a project sidebar item drag or targeting a non-draggable item
        event.dataTransfer.dropEffect = 'none'; // Disallow drop
    }
}

/** Handles dragging leaving a project sidebar item (remove indicator). */
function handleProjectDragLeave(event) {
     const targetItem = event.currentTarget;
     const related = event.relatedTarget;

     // If leaving the target element but entering a child element or another list item, do nothing
     // The dragover event on the new item will handle adding the new indicator.
     // Only remove if truly leaving the list area or dragging over a non-droppable item.
     const isEnteringProjectItem = related && related.closest('.project-list-item');
     const isLeavingList = !related || !projectListElement.contains(related);

     if (!isEnteringProjectItem || isLeavingList) {
          projectListElement.querySelectorAll('.drag-over-indicator, .drag-over-indicator-bottom').forEach(el => {
              el.classList.remove('drag-over-indicator', 'drag-over-indicator-bottom');
          });
     }
}


/** Handles dropping a project sidebar item. */
function handleProjectDrop(event) {
    event.preventDefault(); // Prevent default action
    const targetItem = event.currentTarget;
    const draggedKey = event.dataTransfer.getData('text/projectKey');
    const draggedIsPinned = event.dataTransfer.getData('text/isPinned') === 'true';
    const targetKey = targetItem.getAttribute('data-project-key');
    const targetIsPinned = targetItem.getAttribute('data-is-pinned') === 'true';

    // Remove all drag-over indicators
     projectListElement.querySelectorAll('.drag-over-indicator, .drag-over-indicator-bottom').forEach(el => {
         el.classList.remove('drag-over-indicator', 'drag-over-indicator-bottom');
     });

    // Ignore drop if it's the same item, dropping between pinned/unpinned sections, or onto a static item
    if (draggedKey === targetKey || draggedIsPinned !== targetIsPinned || targetItem.classList.contains('static-item')) {
        return;
    }

     // --- Update projectsData.projectOrder ---
     // projectOrder only manages the order of *unpinned* projects.
     // Pinned projects are sorted alphabetically and displayed before unpinned ones.
     // Therefore, project drag/drop only changes order *within* the unpinned list.
     if (draggedIsPinned) {
         console.warn("Pinned project drag/drop reordering within pinned group is not yet implemented. ProjectOrder array controls unpinned order only.");
         return; // Currently, only unpinned items can be reordered by manipulating projectOrder
     }

     // Find the keys of currently unpinned projects based on projectOrder
     const unpinnedKeys = projectsData.projectOrder.filter(key => {
         const projData = projectsData.projects[key];
         return projData && !projData.isPinned && !projData.isArchived;
     });

     const draggedIndex = unpinnedKeys.indexOf(draggedKey);
     const targetIndex = unpinnedKeys.indexOf(targetKey);

    if (draggedIndex === -1 || targetIndex === -1) {
         console.error("Dragged or target unpinned project not found in order list.", { draggedKey, targetKey, unpinnedKeys });
         return;
    }

    // Determine insertion index in the unpinnedKeys array based on visual drop position
    const rect = targetItem.getBoundingClientRect();
    const isDroppedBefore = event.clientY < rect.top + rect.height / 2;
    let insertIndex = targetIndex;

     // Adjust insert index if removing from an earlier position shifts the target position
    if (draggedIndex < targetIndex) {
         insertIndex--; // Removing item before target shifts target's index down by 1
    }

    // If dropped below the target, insert after the target's new position
     if (!isDroppedBefore) {
         insertIndex++;
     }

     // Ensure the insert index is within bounds
     insertIndex = Math.max(0, Math.min(unpinnedKeys.length, insertIndex));


     saveStateForUndo(); // <<< SAVE STATE BEFORE CHANGE

     // Remove the dragged key from the unpinnedKeys array
     unpinnedKeys.splice(draggedIndex, 1);
     // Insert the dragged key into the unpinnedKeys array at the new position
     unpinnedKeys.splice(insertIndex, 0, draggedKey);

     // Update the main projectsData.projectOrder array
     // This array is used by populateProjectList to get the UNPINNED order.
     // We need to rebuild the main order array to contain ALL projects in their correct logical order (pinned then unpinned).
     const pinnedKeys = Object.keys(projectsData.projects)
        .filter(name => projectsData.projects[name]?.isPinned && !projectsData.projects[name]?.isArchived)
        .sort(); // Pinned are sorted alphabetically

     // Construct the new projectOrder: Pinned keys + new unpinned keys order
     // (Exclude the All Important key, it's not in this data structure's order)
     projectsData.projectOrder = [...pinnedKeys, ...unpinnedKeys];

     saveProjectsData();
     updateUIFromState(false); // Re-render the sidebar with the new order
}



// --- Event Listeners Setup ---
function setupEventListeners() {
    // Sidebar Project Add Button
    addProjectButtonSidebar.addEventListener('click', openProjectModal);

    // Task Modal Buttons & Overlay Click
    closeTaskModalButton.addEventListener('click', closeTaskModal);
    cancelTaskModalButton.addEventListener('click', closeTaskModal);
    addTaskModal.addEventListener('click', (event) => { // Close if clicking overlay
        if (event.target === addTaskModal) closeTaskModal();
    });
    saveTaskButton.addEventListener('click', () => {
        if (addTaskFromModal()) closeTaskModal(); // Add task and close modal on success
    });
    // Save task on Enter in name/desc fields (allow shift+enter in desc)
    modalTaskNameInput.addEventListener('keypress', (event) => {
         if (event.key === 'Enter' && !event.shiftKey) saveTaskButton.click();
    });
    modalTaskDescInput.addEventListener('keypress', (event) => {
         if (event.key === 'Enter' && !event.shiftKey) {
            // saveTaskButton.click(); // Option: save on Enter in description
         }
    });


    // Project Modal Buttons & Overlay Click
    closeProjectModalButton.addEventListener('click', closeProjectModal);
    cancelProjectModalButton.addEventListener('click', closeProjectModal);
    addProjectModal.addEventListener('click', (event) => { // Close if clicking overlay
        if (event.target === addProjectModal) closeProjectModal();
    });
    saveProjectButton.addEventListener('click', () => {
        if (createNewProjectFromModal()) closeProjectModal(); // Create project and close modal on success
    });
    // Save project on Enter in name field
    modalProjectNameInput.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') saveProjectButton.click();
    });

    // Add Task Buttons in Columns
    addTaskColumnButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetStatus = button.getAttribute('data-status-target');
            if (targetStatus) {
                openTaskModal(targetStatus); // Open modal with correct target status
            } else {
                console.error("Could not determine target status for add task button.");
            }
        });
    });

    // Settings Modal Buttons & Overlay Click
    openSettingsButton.addEventListener('click', openSettingsModal);
    closeSettingsModalButton.addEventListener('click', closeSettingsModal);
    doneSettingsModalButton.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', (event) => { // Close if clicking overlay
        if (event.target === settingsModal) closeSettingsModal();
    });

    // Settings Modal - Max Undo Steps Input
     maxUndoStepsInput.addEventListener('change', () => {
          let newValue = parseInt(maxUndoStepsInput.value);
          // Validate and clamp the value
          if (isNaN(newValue) || newValue < 1) {
              newValue = 1;
          } else if (newValue > 100) {
              newValue = 100;
          }
          maxUndoStepsInput.value = newValue; // Update input field if clamped
          maxUndoSteps = newValue;
          localStorage.setItem(UNDO_STORAGE_KEY, maxUndoSteps.toString());

          // Trim history stack if max steps decreased
          while (historyStack.length > maxUndoSteps) {
              historyStack.shift(); // Remove oldest entries
          }
          updateUndoRedoButtonStates(); // Update buttons in case history became empty
          console.log("Max undo steps set to:", maxUndoSteps);
     });

    // Confirmation Modal Buttons & Overlay Click
    confirmYesButton.addEventListener('click', handleConfirmation);
    confirmNoButton.addEventListener('click', closeConfirmationModal);
    confirmationModal.addEventListener('click', (event) => { // Close if clicking overlay
         if(event.target === confirmationModal) closeConfirmationModal();
    });

     // Undo/Redo Buttons
     undoButton.addEventListener('click', undoLastAction);
     redoButton.addEventListener('click', redoLastAction);

    // Global Keyboard Shortcuts (Escape, Undo/Redo)
     document.addEventListener('keydown', (event) => {
          // Check if Ctrl (or Cmd on Mac) is pressed
          const isCtrlOrCmd = event.ctrlKey || event.metaKey;
          const isShift = event.shiftKey;

          // Check if focus is inside an input/textarea/editable element
          const activeElement = document.activeElement;
          const isInputFocused = activeElement && (
              activeElement.tagName === 'INPUT' ||
              activeElement.tagName === 'TEXTAREA' ||
              activeElement.isContentEditable
          );

          // Handle Escape Key
          if (event.key === 'Escape') {
              // Close open modals
              if (addProjectModal.classList.contains('open')) { closeProjectModal(); event.preventDefault(); }
              else if (addTaskModal.classList.contains('open')) { closeTaskModal(); event.preventDefault(); }
              else if (settingsModal.classList.contains('open')) { closeSettingsModal(); event.preventDefault(); }
              else if (confirmationModal.classList.contains('open')) { closeConfirmationModal(); event.preventDefault(); }
              // Cancel active inline edits by triggering blur (which handles cancel/save)
              else if (activeInlineEditInput) { activeInlineEditInput.blur(); event.preventDefault(); } // Prevent default escape behavior
              else if (activeInlineDateInput) { activeInlineDateInput.blur(); event.preventDefault(); } // Prevent default escape behavior
          }
          // Handle Undo/Redo Shortcuts (only if not typing in an input)
          else if (isCtrlOrCmd && !isInputFocused) {
              if (event.key === 'z' || event.key === 'Z') {
                  event.preventDefault(); // Prevent browser's default undo/redo
                  if (!isShift) { // Ctrl+Z for Undo
                      if (!undoButton.disabled) undoLastAction();
                  } else { // Ctrl+Shift+Z for Redo (common alternative)
                      if (!redoButton.disabled) redoLastAction();
                  }
              } else if (event.key === 'y' || event.key === 'Y') {
                  event.preventDefault(); // Prevent browser's default redo
                  if (!redoButton.disabled) redoLastAction();
              }
          }
     });


    // Kanban Column Drag/Drop Listeners
    columns.forEach(column => {
        column.addEventListener('dragover', handleColumnDragOver);
        column.addEventListener('dragleave', handleColumnDragLeave);
        column.addEventListener('drop', handleColumnDrop);
    });

    // Board Title Inline Edit Listener
    boardTitleElement.addEventListener('dblclick', () => {
         // Allow editing only if it's a specific project, not "All Important"
         if (currentProjectName !== ALL_PROJECTS_VIEW_KEY) {
             handleInlineEdit(boardTitleElement, currentProjectName, 'projectName');
         }
    });

    // Settings Data Management Buttons
    exportDataButtonModal.addEventListener('click', exportData);
    importDataButtonModal.addEventListener('click', triggerImport);
    importFileInput.addEventListener('change', importData); // Listener for file selection
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing App.");
    try {
        loadProjectsData(); // Load data and undo settings first
        // UI updates are now mostly handled by load/updateUIFromState
        updateUIFromState(false); // Perform initial render based on loaded state
        setupEventListeners(); // Setup all event listeners
        updateUndoRedoButtonStates(); // Set initial button state explicitly after setup
        console.log("Initialization complete.");
    } catch (error) {
        // Catastrophic error during init - display error message
        console.error("Error during initialization:", error);
        document.body.innerHTML = `<div class="p-4 text-red-500">Error loading application data. Please check the console for details.<br>If the issue persists, you may need to clear application data from your browser's Local Storage for this page (key: <code>${LOCAL_STORAGE_KEY}</code>). This will reset the app to its default state.<br><pre>${error.stack}</pre></div>`;
    }
});
