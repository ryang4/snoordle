class App {
  constructor() {
    this.state = {
      words: [],
      username: '',
      postId: '',
      letterMap: new Map(),
      foundWords: new Set(),
      timeLeft: 10,
      timerInterval: null,
      currentRound: 0,
      maxRounds: 5,
      isGameActive: true,
      wordsByRound: [], // Will store words for each round
      keyboardListener: null
    };

    const letterGrid = document.querySelector('#letter-grid');
    const wordInput = document.querySelector('#word-input');
    const submitButton = document.querySelector('#submit-word');
    const foundWordsList = document.querySelector('#found-words-list');
    const wordCountElement = document.querySelector('#word-count');
    const toast = document.querySelector('#toast');
    const timerElement = document.querySelector('#timer');
    const instructionsScreen = document.querySelector('#instructions-screen');
    const gameContainer = document.querySelector('#game-container');
    const startGameButton = document.querySelector('#start-game');

    const showToast = (message) => {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2000);
    };

    const updateFoundWordsList = () => {
      foundWordsList.innerHTML = '';
      this.state.foundWords.forEach(word => {
        const wordElement = document.createElement('span');
        wordElement.classList.add('found-word');
        wordElement.textContent = word;
        foundWordsList.appendChild(wordElement);
      });
      wordCountElement.textContent = this.state.foundWords.size;
    };

    const submitWord = () => {
      if (!this.state.isGameActive) return;
      
      const word = wordInput.value.toLowerCase();
      if (word) {
        if (this.state.foundWords.has(word)) {
          showToast(`"${word}" has already been found!`);
        } else if (canMakeWord(word, this.state.words[this.state.currentRound - 1])) {
          this.state.foundWords.add(word);
          showToast(`Found "${word}"!`);
        } else {
          showToast(`Can't make "${word}" from the current letters!`);
        }
        wordInput.value = '';
      }
    };

    const canMakeWord = (attempt, sourceWord) => {
      // Convert both words to lowercase
      const sourceLetters = new Set(sourceWord.toLowerCase().split(''));
      
      // Check if each letter in attempt exists in source word
      return attempt.toLowerCase().split('').every(letter => sourceLetters.has(letter));
    };

    // Add event listeners
    submitButton.addEventListener('click', submitWord);
    wordInput.addEventListener('keydown', (e) => {  // Changed from keyup to keydown
      if (e.key === 'Enter') {
        e.preventDefault();  // Prevent default form submission
        submitWord();
      }
    });

    const processLetters = (words) => {
      const letterMap = new Map();
      words.forEach(word => {
        [...word.toUpperCase()].forEach(letter => {
          letterMap.set(letter, (letterMap.get(letter) || 0) + 1);
        });
      });
      this.state.letterMap = letterMap;
      return letterMap;
    };

    const shuffleArray = (array) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    const handleBackspace = () => {
      const currentValue = wordInput.value;
      if (currentValue.length > 0) {
        wordInput.value = currentValue.slice(0, -1);
      }
    };

    const createLetterGrid = letterMap => {
      letterGrid.innerHTML = '';
      const shuffledEntries = shuffleArray(Array.from(letterMap.entries()));
      const tiles = new Map();

      // Create letter tiles
      shuffledEntries.forEach(([letter, frequency]) => {
        const tile = document.createElement('div');
        tile.classList.add('tile');
        tile.innerText = letter;
        tile.addEventListener('click', () => {
          wordInput.value += letter;
          animateTile(tile);
        });
        letterGrid.appendChild(tile);
        tiles.set(letter, tile);
      });

      // Add backspace tile
      const backspaceTile = document.createElement('div');
      backspaceTile.classList.add('tile', 'backspace');
      backspaceTile.innerText = '⌫';
      backspaceTile.addEventListener('click', () => {
        handleBackspace();
        animateTile(backspaceTile);
      });
      letterGrid.appendChild(backspaceTile);

      // Remove old keyboard listener if it exists
      if (this.state.keyboardListener) {
        document.removeEventListener('keydown', this.state.keyboardListener);
      }

      // Add keyboard support
      const keyboardListener = (e) => {
        if (e.key === 'Backspace') {
          handleBackspace();
          animateTile(backspaceTile);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          submitWord();
          return;
        }

        const pressedKey = e.key.toUpperCase();
        const tile = tiles.get(pressedKey);
        if (tile) {
          wordInput.value += pressedKey;
          animateTile(tile);
        }
      };

      document.addEventListener('keydown', keyboardListener);
      this.state.keyboardListener = keyboardListener;

      // Animation helper
      const animateTile = (tile) => {
        tile.classList.add('active');
        setTimeout(() => tile.classList.remove('active'), 200);
      };
    };

    const startNextRound = () => {
      if (this.state.currentRound >= this.state.maxRounds) {
        endGame();
        return;
      }

      // Get current word and create its letter grid
      const currentWord = this.state.words[this.state.currentRound];
      if (!currentWord) {
        endGame();
        return;
      }

      // Create letter map from single word
      const letters = [...currentWord.toUpperCase()];
      const letterMap = new Map();
      letters.forEach(letter => {
        letterMap.set(letter, (letterMap.get(letter) || 0) + 1);
      });

      createLetterGrid(letterMap);
      this.state.currentRound++;
      startTimer();
    };

    const endGame = () => {
      this.state.isGameActive = false;
      clearInterval(this.state.timerInterval);
      showGameResults();
    };

    const showGameResults = () => {
      letterGrid.innerHTML = '';  // Clear existing content
      const resultsDiv = document.createElement('div');
      resultsDiv.classList.add('game-results');
      resultsDiv.innerHTML = `
        <h2>Game Over!</h2>
        <p>You found ${this.state.foundWords.size} words:</p>
        <div class="found-words-list">
          ${Array.from(this.state.foundWords).join(', ')}
        </div>
      `;
      letterGrid.appendChild(resultsDiv);
    };

    const showRoundSummary = () => {
      const currentWord = this.state.words[this.state.currentRound - 1];
      const roundWords = Array.from(this.state.foundWords)
        .filter(word => canMakeWord(word, currentWord));

      // Clear input and grid
      wordInput.value = '';
      letterGrid.innerHTML = '';
      
      // Create and add summary div
      const summaryDiv = document.createElement('div');
      summaryDiv.classList.add('round-summary');
      
      // Only show word count if we have it
      const wordCountText = this.state.wordCounts && this.state.wordCounts[currentWord] 
        ? `was used ${this.state.wordCounts[currentWord]} times in the past day`
        : '';

      summaryDiv.innerHTML = `
        <h2>Round ${this.state.currentRound} Complete!</h2>
        <p class="source-word"><strong>${currentWord.toUpperCase()}</strong> ${wordCountText}</p>
        <p>You found ${roundWords.length} words:</p>
        <div class="found-words-list">
          ${roundWords.join(', ') || 'No words found'}
        </div>
        <button id="next-round-btn">Next Round</button>
      `;
      
      letterGrid.appendChild(summaryDiv);
      
      // Clear previous round's found words
      this.state.foundWords.clear();
      
      // Add event listener to the next round button
      const nextButton = document.querySelector('#next-round-btn');
      if (nextButton) {
        nextButton.addEventListener('click', startNextRound);
      }
    };

    const startTimer = () => {
      clearInterval(this.state.timerInterval);
      this.state.timeLeft = 10;
      updateTimerDisplay();
      
      this.state.timerInterval = setInterval(() => {
        this.state.timeLeft--;
        updateTimerDisplay();
        
        if (this.state.timeLeft <= 0) {
          clearInterval(this.state.timerInterval);
          wordInput.value = '';
          showRoundSummary();  // Show summary instead of immediately starting next round
        }
      }, 1000);
    };

    const updateTimerDisplay = () => {
      if (timerElement) {
        timerElement.textContent = this.state.timeLeft;
      }
    };

    const startGame = () => {
      instructionsScreen.style.display = 'none';
      gameContainer.style.display = 'block';
      startNextRound();
    };

    startGameButton.addEventListener('click', startGame);

    window.addEventListener('message', (ev) => {
      const { type, data } = ev.data;

      if (type === 'devvit-message') {
        const { message } = data;
        console.log('Received message:', message); // Add logging

        if (message.type === 'initialData') {
          const { username, words, postId, wordCounts } = message.data;
          this.state = {
            ...this.state,
            username,
            words,
            postId,
            wordCounts  // Store word counts in state
          };
        }
      }
    });
  }
}

new App();
