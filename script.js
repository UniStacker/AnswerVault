// Service worker and Updatimg setup
function showUpdateNotification(onUpdate) {
  const notification = document.getElementById('update-notification');
  const updateButton = document.getElementById('update-button');

  // Show the notification
  notification.style.display = 'block';

  // Handle the update button click
  updateButton.addEventListener('click', () => {
    notification.style.display = 'none';
    onUpdate(); // Trigger the update
    window.location.reload(); // Refresh the page to load the new version
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').then(registration => {
    console.log('Service Worker registered:', registration);

    // Listen for updates
    registration.onupdatefound = () => {
      const newWorker = registration.installing;

      newWorker.onstatechange = () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // Notify user about the update
            showUpdateNotification(() => {
              // Trigger update when user accepts
              newWorker.postMessage('SKIP_WAITING');
            });
          } else {
            console.log('Content is now available offline.');
          }
        }
      };
    };
  }).catch(error => {
    console.error('Service Worker registration failed:', error);
  });
}


// A list to store questions with their answers
const qna = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem("qna")) {
    localStorage.setItem("qna", JSON.stringify([]));
  } else {
    const savedQnA = JSON.parse(localStorage.getItem("qna"));
    qna.push(...savedQnA);
  }
  showRandomQuestion();
});

let right = 0;
let wrong = 0;
let currentQuestion = {};

// DOM elements
const add_screen = document.querySelector("#add-screen");
const add_question = document.querySelector("#add-question-in");
const add_answer = document.querySelector("#add-answer-in");
const submit_ans = document.querySelector("#submit");
const answer_in = document.querySelector("#answer-in");

//Add button event listener
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector("#add-btn").addEventListener("click", () => {
        setTimeout(() => add_screen.style.display = "flex", 200);
    });
});

// Function to save the progress
function save() {
  localStorage.setItem("qna", JSON.stringify(qna));
}

// Function to show a random character
 function showRandomQuestion() {
  const question_div = document.getElementById('question');
  if (qna.length === 0) {
    question_div.textContent = "No questions available.";
    return;
  }
  const randomIndex = Math.floor(Math.random() * qna.length);
  currentQuestion = qna[randomIndex];
  question_div.textContent = currentQuestion.q;
  question_div.classList.add("anim-class");
  setTimeout(() => question_div.classList.remove("anim-class"), 500);
}

// Function to check the user's answer
function checkAnswer(answer) {
  if (answer.trim().toLowerCase() === currentQuestion.a.trim()) {
    right++;
  } else {
    wrong++;
  }
  document.getElementById('right').textContent = right;
  document.getElementById('wrong').textContent = wrong;
  showRandomQuestion();
}

document.addEventListener('DOMContentLoaded', () => {
    submit_ans.addEventListener("click", () => {
        if (answer_in.value) {
            checkAnswer(answer_in.value);
            answer_in.value = "";
        }
        else {
          answer_in.placeholder = "Answer is empty";
          setTimeout(() => {answer_in.placeholder = "Type answer here...";}, 1000);
        }
      });
});

// Listens for clicks on submit button in add screen
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector("#add-submit").addEventListener("click", () => {
        let q = add_question.value;
        let a = add_answer.value.toLowerCase();
        if (q && a) {
          qna.push({q, a});
          add_question.value = "";
          add_answer.value = "";
        }
        setTimeout(() => add_screen.style.display = "none", 200);
        save();
        showRandomQuestion();
    });
});

// Initialize the game
document.addEventListener('DOMContentLoaded', () => showRandomQuestion());