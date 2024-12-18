class App {
  constructor() {
    this.state = {
      words: [],
      username: '',
      postId: '',
      letterMap: new Map(),
      foundWords: new Set(),
      allFoundWords: new Set(), // Add this to track all words across rounds
      timeLeft: 10,
      timerInterval: null,
      currentRound: 0,
      maxRounds: 5,
      isGameActive: true,
      wordsByRound: [], // Will store words for each round
      keyboardListener: null,
      roundWords: new Map(), // Add this to track which words were found in which rounds
      totalScore: 0
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
        } else if (canMakeWord(word, this.state.words[this.state.currentRound - 1].word)) {
          this.state.foundWords.add(word);
          this.state.allFoundWords.add(word); // Add to overall collection
          
          // Store which round this word was found in
          this.state.roundWords.set(word, this.state.currentRound - 1);
          
          // Calculate score for this word
          const currentSourceWord = this.state.words[this.state.currentRound - 1].word.toLowerCase();
          const wordScore = calculateWordScore(word, currentSourceWord);
          this.state.totalScore += wordScore;
          
          showToast(`Found "${word}"! +${wordScore} points`);
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

    const calculateWordScore = (word, sourceWord) => {
      // Base score is length of word
      let score = word.length;
      
      // If word matches the source word, multiply by 10
      if (word.toLowerCase() === sourceWord.toLowerCase()) {
        score *= 10;
      }
      
      return score;
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

      // Get current word object and create its letter grid
      const currentWordObj = this.state.words[this.state.currentRound];
      if (!currentWordObj) {
        endGame();
        return;
      }

      // Create letter map from word
      const letters = [...currentWordObj.word.toUpperCase()];
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
      showSentencePhase(); // Show sentence phase before final results
    };

    const hideGameElements = () => {
      document.querySelector('#game-controls').style.display = 'none';
      document.querySelector('.game-header').style.display = 'none';
    };

    const showGameElements = () => {
      document.querySelector('#game-controls').style.display = 'flex';
      document.querySelector('.game-header').style.display = 'flex';
    };

    const showGameResults = () => {
      document.querySelector('#sentence-phase').style.display = 'none';
      hideGameElements();
      
      const summaryContainer = document.querySelector('#summary-container');
      summaryContainer.innerHTML = '';
      
      const resultsDiv = document.createElement('div');
      resultsDiv.classList.add('game-results');
    
      // Calculate final statistics
      const foundWords = Array.from(this.state.allFoundWords);
      const roundWordCounts = Array(this.state.maxRounds).fill(0);
      const roundScores = Array(this.state.maxRounds).fill(0);
      
      foundWords.forEach(word => {
        const roundIndex = this.state.roundWords.get(word);
        if (roundIndex !== undefined) {
          roundWordCounts[roundIndex]++;
          const sourceWord = this.state.words[roundIndex].word.toLowerCase();
          roundScores[roundIndex] += calculateWordScore(word, sourceWord);
        }
      });

      const sortedWords = foundWords.sort().map(word => {
        const isTopWord = this.state.words.some(w => w.word.toLowerCase() === word.toLowerCase());
        const roundIndex = this.state.roundWords.get(word);
        const sourceWord = this.state.words[roundIndex].word.toLowerCase();
        const score = calculateWordScore(word, sourceWord);
        return `<span class="found-word ${isTopWord ? 'top-word' : ''}">${word} (${score}pts)</span>`;
      });
    
      const roundSummaries = roundScores
        .map((score, i) => `Round ${i + 1}: ${roundWordCounts[i]} words, ${score} points`)
        .join('<br>');

      resultsDiv.innerHTML = `
        <h2>Game Over!</h2>
        <h3>Final Score: ${this.state.totalScore} points!</h3>
        <p class="bonus-note">(Including sentence bonus points)</p>
        <div class="round-breakdown">
          ${roundSummaries}
        </div>
        <p>You found ${this.state.allFoundWords.size} words:</p>
        <div class="found-words-list">
          ${sortedWords.join(' ')}
        </div>
        <h3 style="margin-top: 2rem;">Today's Top Words:</h3>
        <div class="found-words-list">
          ${this.state.words.map(w => 
            `<span class="found-word top-word">${w.word} (${w.score} uses)</span>`
          ).join(' ')}
        </div>
      `;
      
      summaryContainer.appendChild(resultsDiv);
    };

    const showRoundSummary = () => {
      hideGameElements();
      
      const currentWordObj = this.state.words[this.state.currentRound - 1];
      const roundWords = Array.from(this.state.foundWords)
        .filter(word => canMakeWord(word, currentWordObj.word));

      // Clear input and grid
      wordInput.value = '';
      
      // Use summary container instead of letter grid
      const summaryContainer = document.querySelector('#summary-container');
      summaryContainer.innerHTML = '';
      
      const summaryDiv = document.createElement('div');
      summaryDiv.classList.add('round-summary');
      
      summaryDiv.innerHTML = `
        <h2>Round ${this.state.currentRound} Complete!</h2>
        <p class="source-word">
          <strong>${currentWordObj.word.toUpperCase()}</strong> 
          was used ${currentWordObj.score} times in the past day
        </p>
        <p>You found ${roundWords.length} words:</p>
        <div class="found-words-list">
          ${roundWords.join(', ') || 'No words found'}
        </div>
        <button id="next-round-btn">Next Round</button>
      `;
      
      summaryContainer.appendChild(summaryDiv);
      
      // Clear previous round's found words
      this.state.foundWords.clear();
      
      // Add event listener to the next round button
      const nextButton = document.querySelector('#next-round-btn');
      if (nextButton) {
        nextButton.addEventListener('click', () => {
          summaryContainer.innerHTML = '';
          showGameElements();
          startNextRound();
        });
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
      showGameElements();
      startNextRound();
    };

    startGameButton.addEventListener('click', startGame);

    window.addEventListener('message', (ev) => {
      const { type, data } = ev.data;

      if (type === 'devvit-message') {
        const { message } = data;
        console.log('Received message:', message); // Add logging

        if (message.type === 'initialData') {
          const { username, words, postId } = message.data;
          
          this.state = {
            ...this.state,
            username,
            words, // Keep the full array of {word, score} objects
            postId
          };
        }
      }
    });

    const showSentencePhase = () => {
      hideGameElements();
      letterGrid.innerHTML = ''; // Clear the letter grid
      
      const sentencePhase = document.querySelector('#sentence-phase');
      const summaryContainer = document.querySelector('#summary-container');
      summaryContainer.innerHTML = '';
      sentencePhase.style.display = 'flex';
      
      // Group words by round
      const wordsByRound = new Map();
      this.state.allFoundWords.forEach(word => {
        const roundIndex = this.state.roundWords.get(word);
        if (!wordsByRound.has(roundIndex)) {
          wordsByRound.set(roundIndex, new Set());
        }
        wordsByRound.get(roundIndex).add(word);
      });
      
      // Create round columns
      const foundWordsRef = sentencePhase.querySelector('.found-words-reference');
      foundWordsRef.innerHTML = '';
      
      // For each round, create a column
      for (let i = 0; i < this.state.maxRounds; i++) {
        const roundWords = Array.from(wordsByRound.get(i) || []).sort();
        const sourceWord = this.state.words[i].word.toUpperCase();
        
        const column = document.createElement('div');
        column.classList.add('round-words-column');
        column.innerHTML = `
          <h4>Round ${i + 1}: ${sourceWord}</h4>
          <div class="found-words-list">
            ${roundWords.map(word => `<span class="found-word">${word}</span>`).join(' ')}
          </div>
        `;
        foundWordsRef.appendChild(column);
      }
      
      // Handle sentence submission
      const submitButton = document.querySelector('#submit-sentence');
      submitButton.addEventListener('click', () => {
        const sentence = document.querySelector('#sentence-input').value.toLowerCase();
        const words = sentence.split(/\s+/);
        let bonusPoints = 0;
        
        // Calculate bonus points for using found words
        const usedWords = new Set();
        words.forEach(word => {
          if (this.state.allFoundWords.has(word) && !usedWords.has(word)) {
            bonusPoints += 3;
            usedWords.add(word);
            showToast(`+3 points for using "${word}"!`);
          }
        });
        
        this.state.totalScore += bonusPoints;
        
        // Hide sentence phase and show final results
        sentencePhase.style.display = 'none';
        showGameResults();
      });
    };
  }
}

new App();
