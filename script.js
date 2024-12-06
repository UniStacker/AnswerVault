document.addEventListener("DOMContentLoaded", () => {
    // Service worker and Updating setup
    function showUpdateNotification(onUpdate) {
        const notification = document.getElementById('update-notification');
        const updateButton = document.getElementById('update-button');
        notification.style.display = 'block';
        updateButton.addEventListener('click', () => {
            notification.style.display = 'none';
            onUpdate();
            window.location.reload();
        });
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js').then(registration => {
            console.log('Service Worker registered:', registration);
            registration.onupdatefound = () => {
                const newWorker = registration.installing;
                newWorker.onstatechange = () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateNotification(() => newWorker.postMessage('SKIP_WAITING'));
                    }
                };
            };
        }).catch(error => {
            console.error('Service Worker registration failed:', error);
        });
    }

    // Theme management
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleText = themeToggle.querySelector('.btn-text');
    const checkUpdateBtn = document.getElementById('check-update');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    function setTheme(isDark) {
        document.body.classList.toggle('dark-theme', isDark);
        themeToggleText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme === 'dark');
    } else {
        setTheme(prefersDarkScheme.matches);
    }

    themeToggle.addEventListener('click', () => {
        setTheme(!document.body.classList.contains('dark-theme'));
    });

    // App Update functionality
    async function checkForUpdates() {
        try {
            checkUpdateBtn.classList.add('updating');
            const btnText = checkUpdateBtn.querySelector('.btn-text');
            btnText.textContent = 'Checking for updates...';

            const confirmed = await showCustomAlert('Would you like to check for and install updates? This will refresh the app.');
            
            if (confirmed) {
                // Clear browser cache for our app files
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));

                // Clear service worker
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(reg => reg.unregister()));
                }

                // Reload the page to get fresh files
                window.location.reload(true);
            } else {
                checkUpdateBtn.classList.remove('updating');
                btnText.textContent = 'Check for Updates';
            }
        } catch (error) {
            console.error('Update error:', error);
            checkUpdateBtn.classList.remove('updating');
            const btnText = checkUpdateBtn.querySelector('.btn-text');
            btnText.textContent = 'Update failed';
            setTimeout(() => {
                btnText.textContent = 'Check for Updates';
            }, 2000);
        }
    }

    checkUpdateBtn.addEventListener('click', checkForUpdates);

    // Data management
    let qna = [];
    let currentQuestion = null;
    let streak = 0;
    let categories = new Set();

    // Stats
    let stats = {
        correct: 0,
        wrong: 0
    };

    // Load saved data
    function loadSavedData() {
        try {
            const savedQnA = JSON.parse(localStorage.getItem('qna') || '[]');
            qna = savedQnA;
            stats.correct = parseInt(localStorage.getItem('correct') || '0', 10);
            stats.wrong = parseInt(localStorage.getItem('wrong') || '0', 10);
            streak = parseInt(localStorage.getItem('streak') || '0', 10);
            
            // Update UI
            updateStats();
            updateCategories();
            showRandomQuestion();
        } catch (error) {
            console.error('Error loading saved data:', error);
            // Reset to defaults if there's an error
            qna = [];
            stats.correct = 0;
            stats.wrong = 0;
            streak = 0;
            updateStats();
        }
    }

    function saveData() {
        try {
            localStorage.setItem('qna', JSON.stringify(qna));
            localStorage.setItem('correct', stats.correct.toString());
            localStorage.setItem('wrong', stats.wrong.toString());
            localStorage.setItem('streak', streak.toString());
        } catch (error) {
            console.error('Error saving data:', error);
            showFeedback(false, 'Error saving progress. Please check your storage settings.');
        }
    }

    // UI Elements
    const questionElement = document.getElementById('question');
    const answerInput = document.getElementById('answer-in');
    const submitButton = document.getElementById('submit');
    const addScreen = document.getElementById('add-screen');
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsClose = document.getElementById('settings-close');
    const resetQuestionsBtn = document.getElementById('reset-questions');
    const resetAppBtn = document.getElementById('reset-app');
    const resetStatsBtn = document.getElementById('reset-stats');
    const questionsList = document.getElementById('questions-list');
    const hintBtn = document.getElementById('hint-btn');
    const hintText = document.getElementById('hint-text');
    const addCategoryInput = document.getElementById('add-category-in');
    const addQuestionInput = document.getElementById('add-question-in');
    const addAnswerInput = document.getElementById('add-answer-in');
    const addHintInput = document.getElementById('add-hint-in');
    const addSubmitButton = document.getElementById('add-submit');
    const addCancelButton = document.getElementById('add-cancel');
    const categorySelect = document.getElementById('category-select');
    const categoryTag = document.getElementById('category-tag');
    const resultFeedback = document.getElementById('result-feedback');

    // Update UI functions
    function updateStats() {
        document.getElementById('right').textContent = stats.correct;
        document.getElementById('wrong').textContent = stats.wrong;
        document.getElementById('streak-count').textContent = streak;
        updateProgress();
    }

    function updateProgress() {
        const total = stats.correct + stats.wrong;
        const percentage = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
        document.getElementById('progress-percentage').textContent = percentage;
        document.getElementById('progress-fill').style.width = `${percentage}%`;
    }

    function updateCategories() {
        categories = new Set(qna.map(item => item.category).filter(Boolean));
        categorySelect.innerHTML = '<option value="all">All Categories</option>';
        Array.from(categories).sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }

    function showRandomQuestion() {
        const selectedCategory = categorySelect.value;
        const filteredQuestions = selectedCategory === 'all' 
            ? qna 
            : qna.filter(q => q.category === selectedCategory);

        if (filteredQuestions.length === 0) {
            questionElement.textContent = "No questions available.";
            hintBtn.classList.add('hidden');
            categoryTag.textContent = '';
            currentQuestion = null;
            return;
        }

        const randomIndex = Math.floor(Math.random() * filteredQuestions.length);
        currentQuestion = filteredQuestions[randomIndex];
        
        questionElement.textContent = currentQuestion.question;
        questionElement.classList.add('anim-class');
        setTimeout(() => questionElement.classList.remove('anim-class'), 500);

        // Update hint visibility
        if (currentQuestion.hint) {
            hintBtn.classList.remove('hidden');
            hintText.classList.add('hidden');
        } else {
            hintBtn.classList.add('hidden');
            hintText.classList.add('hidden');
        }

        // Show category tag
        categoryTag.textContent = currentQuestion.category || '';
        
        // Clear previous answer and feedback
        answerInput.value = '';
        resultFeedback.textContent = '';
        answerInput.focus();
    }

    function showFeedback(isCorrect, message) {
        resultFeedback.textContent = message;
        resultFeedback.className = isCorrect ? 'correct-feedback' : 'wrong-feedback';
        questionElement.classList.add(isCorrect ? 'correct-answer' : 'wrong-answer');
        setTimeout(() => {
            questionElement.classList.remove('correct-answer', 'wrong-answer');
        }, 500);
    }

    // Settings functionality
    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'block';
        updateQuestionsList();
    });

    settingsClose.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    // Close settings when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    function updateQuestionsList() {
        questionsList.innerHTML = '';
        qna.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'question-item';
            div.innerHTML = `
                <span>${item.question} (${item.category})</span>
                <button onclick="removeQuestion(${index})">Delete</button>
            `;
            questionsList.appendChild(div);
        });
    }

    // Custom Alert System
    const customAlert = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('alert-message');
    const alertConfirm = document.getElementById('alert-confirm');
    const alertCancel = document.getElementById('alert-cancel');

    function showCustomAlert(message) {
        return new Promise((resolve) => {
            alertMessage.textContent = message;
            customAlert.classList.add('show');

            const handleConfirm = () => {
                customAlert.classList.remove('show');
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                customAlert.classList.remove('show');
                cleanup();
                resolve(false);
            };

            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                } else if (e.key === 'Enter') {
                    handleConfirm();
                }
            };

            const cleanup = () => {
                alertConfirm.removeEventListener('click', handleConfirm);
                alertCancel.removeEventListener('click', handleCancel);
                document.removeEventListener('keydown', handleKeydown);
            };

            alertConfirm.addEventListener('click', handleConfirm);
            alertCancel.addEventListener('click', handleCancel);
            document.addEventListener('keydown', handleKeydown);
        });
    }

    window.removeQuestion = async function(index) {
        const confirmed = await showCustomAlert('Are you sure you want to delete this question?');
        if (confirmed) {
            qna.splice(index, 1);
            saveData();
            updateQuestionsList();
            showRandomQuestion();
        }
    };

    resetStatsBtn.addEventListener('click', async () => {
        const confirmed = await showCustomAlert('Are you sure you want to reset all statistics? This will reset your correct/wrong counts and streak.');
        if (confirmed) {
            stats.correct = 0;
            stats.wrong = 0;
            streak = 0;
            saveData();
            updateStats();
            showFeedback(true, 'Statistics have been reset');
        }
    });

    resetQuestionsBtn.addEventListener('click', async () => {
        const confirmed = await showCustomAlert('Are you sure you want to reset all questions? This cannot be undone.');
        if (confirmed) {
            qna = [];
            saveData();
            updateQuestionsList();
            showRandomQuestion();
            showFeedback(true, 'All questions have been reset');
        }
    });

    resetAppBtn.addEventListener('click', async () => {
        const confirmed = await showCustomAlert('Are you sure you want to reset the entire app? This will clear all data and cannot be undone.');
        if (confirmed) {
            localStorage.clear();
            location.reload();
        }
    });

    // Fix hint functionality
    let hintVisible = false;
    hintBtn.addEventListener('click', () => {
        if (!hintVisible && currentQuestion && currentQuestion.hint) {
            hintText.textContent = currentQuestion.hint;
            hintText.classList.remove('hidden');
            hintBtn.textContent = 'Hide Hint';
            hintVisible = true;
        } else {
            hintText.classList.add('hidden');
            hintBtn.textContent = 'Show Hint';
            hintVisible = false;
        }
    });

    // Category autocomplete with improved positioning
    let autocompleteContainer = null;
    let selectedSuggestionIndex = -1;

    function createAutocompleteContainer() {
        if (autocompleteContainer) {
            autocompleteContainer.remove();
        }
        autocompleteContainer = document.createElement('div');
        autocompleteContainer.className = 'category-suggestions';
        return autocompleteContainer;
    }

    function positionAutocomplete() {
        if (!autocompleteContainer) return;
        
        const inputRect = addCategoryInput.getBoundingClientRect();
        autocompleteContainer.style.position = 'fixed';
        autocompleteContainer.style.width = inputRect.width + 'px';
        autocompleteContainer.style.left = inputRect.left + 'px';
        autocompleteContainer.style.top = (inputRect.bottom + 4) + 'px';
    }

    function showCategorySuggestions() {
        const input = addCategoryInput.value.toLowerCase();
        const suggestions = Array.from(categories).filter(cat => 
            cat.toLowerCase().includes(input)
        );

        // Remove existing suggestions
        if (autocompleteContainer) {
            autocompleteContainer.remove();
        }

        selectedSuggestionIndex = -1;

        if (input && suggestions.length > 0) {
            autocompleteContainer = createAutocompleteContainer();
            
            suggestions.forEach(suggestion => {
                const item = document.createElement('div');
                item.className = 'category-suggestion-item';
                
                // Highlight matching part
                const index = suggestion.toLowerCase().indexOf(input.toLowerCase());
                const beforeMatch = suggestion.slice(0, index);
                const match = suggestion.slice(index, index + input.length);
                const afterMatch = suggestion.slice(index + input.length);
                
                item.innerHTML = `${beforeMatch}<span class="highlight">${match}</span>${afterMatch}`;
                
                item.addEventListener('click', () => {
                    addCategoryInput.value = suggestion;
                    autocompleteContainer.remove();
                    autocompleteContainer = null;
                });
                item.addEventListener('mouseover', () => {
                    selectSuggestion(Array.from(autocompleteContainer.children).indexOf(item));
                });
                autocompleteContainer.appendChild(item);
            });

            document.body.appendChild(autocompleteContainer);
            positionAutocomplete();
        } else {
            autocompleteContainer = null;
        }
    }

    function selectSuggestion(index) {
        if (!autocompleteContainer) return;
        
        const items = autocompleteContainer.querySelectorAll('.category-suggestion-item');
        items.forEach(item => item.classList.remove('selected'));
        
        if (index >= 0 && index < items.length) {
            items[index].classList.add('selected');
            selectedSuggestionIndex = index;
            
            // Ensure the selected item is visible
            const item = items[index];
            const container = autocompleteContainer;
            const itemTop = item.offsetTop;
            const itemBottom = itemTop + item.offsetHeight;
            const containerTop = container.scrollTop;
            const containerBottom = containerTop + container.offsetHeight;

            if (itemTop < containerTop) {
                container.scrollTop = itemTop;
            } else if (itemBottom > containerBottom) {
                container.scrollTop = itemBottom - container.offsetHeight;
            }
        }
    }

    // Update autocomplete position on scroll or resize
    window.addEventListener('scroll', positionAutocomplete);
    window.addEventListener('resize', positionAutocomplete);

    addCategoryInput.addEventListener('input', showCategorySuggestions);
    addCategoryInput.addEventListener('keydown', (e) => {
        const suggestionsDiv = document.querySelector('.category-suggestions');
        if (!suggestionsDiv) return;

        const items = suggestionsDiv.querySelectorAll('.category-suggestion-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectSuggestion(
                    selectedSuggestionIndex < items.length - 1 ? selectedSuggestionIndex + 1 : 0,
                    suggestionsDiv
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectSuggestion(
                    selectedSuggestionIndex > 0 ? selectedSuggestionIndex - 1 : items.length - 1,
                    suggestionsDiv
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0) {
                    const selectedItem = items[selectedSuggestionIndex];
                    addCategoryInput.value = selectedItem.textContent;
                    suggestionsDiv.remove();
                    selectedSuggestionIndex = -1;
                }
                break;
            case 'Escape':
                suggestionsDiv.remove();
                selectedSuggestionIndex = -1;
                break;
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.category-suggestions') && !e.target.closest('#add-category-in')) {
            const suggestions = document.querySelector('.category-suggestions');
            if (suggestions) {
                suggestions.remove();
                selectedSuggestionIndex = -1;
            }
        }
    });

    // Event Listeners
    submitButton.addEventListener('click', () => {
        if (!currentQuestion) {
            showFeedback(false, 'No question available. Add some questions first!');
            return;
        }
        
        const userAnswer = answerInput.value.trim();
        if (!userAnswer) {
            showFeedback(false, 'Please enter an answer');
            answerInput.focus();
            return;
        }

        const isCorrect = userAnswer.toLowerCase() === currentQuestion.answer.trim().toLowerCase();

        if (isCorrect) {
            stats.correct++;
            streak++;
            showFeedback(true, 'Correct!');
        } else {
            stats.wrong++;
            streak = 0;
            showFeedback(false, `Wrong! The correct answer was: ${currentQuestion.answer}`);
        }

        updateStats();
        saveData();
        setTimeout(showRandomQuestion, 1500);
    });

    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitButton.click();
        }
    });

    // Close add screen when clicking outside
    addScreen.addEventListener('click', (e) => {
        if (e.target === addScreen) {
            addScreen.style.display = 'none';
            clearAddInputs();
        }
    });

    document.getElementById('add-btn').addEventListener('click', () => {
        addScreen.style.display = 'flex';
        addQuestionInput.focus();
    });

    addCancelButton.addEventListener('click', () => {
        addScreen.style.display = 'none';
        clearAddInputs();
    });

    addSubmitButton.addEventListener('click', async () => {
        const question = addQuestionInput.value.trim();
        const answer = addAnswerInput.value.trim();
        const hint = addHintInput.value.trim();
        const category = addCategoryInput.value.trim();

        if (!question || !answer) {
            await showCustomAlert('Please fill in both question and answer fields.');
            if (!question) addQuestionInput.focus();
            else if (!answer) addAnswerInput.focus();
            return;
        }

        qna.push({
            question,
            answer,
            hint,
            category
        });

        saveData();
        updateCategories();
        showRandomQuestion();
        addScreen.style.display = 'none';
        clearAddInputs();
    });

    categorySelect.addEventListener('change', showRandomQuestion);

    function clearAddInputs() {
        addQuestionInput.value = '';
        addAnswerInput.value = '';
        addHintInput.value = '';
        addCategoryInput.value = '';
    }

    // Initialize the app
    loadSavedData();
});