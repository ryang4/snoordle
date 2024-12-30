class App {
  constructor() {
    this.state = {
      words: [],
      username: '',
      postId: '',
      letterMap: new Map(),
      foundWords: new Set(),
      allFoundWords: new Set(),
      currentRound: 0,
      maxRounds: 5,
      isGameActive: true,
      wordsByRound: [],
      keyboardListener: null,
      roundWords: new Map(),
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

    const submitWord = () => {
      if (!this.state.isGameActive) return;
      
      const word = wordInput.value.toLowerCase();
      if (word) {
        if (this.state.foundWords.has(word)) {
          showToast(`"${word}" has already been found!`);
        } else if (canMakeWord(word, this.state.words[this.state.currentRound - 1].word)) {
          this.state.foundWords.add(word);
          this.state.allFoundWords.add(word);
          
          this.state.roundWords.set(word, this.state.currentRound - 1);
          
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
      const sourceLetters = new Set(sourceWord.toLowerCase().split(''));
      
      return attempt.toLowerCase().split('').every(letter => sourceLetters.has(letter));
    };

    const calculateWordScore = (word, sourceWord) => {
      if (word.toLowerCase() === sourceWord.toLowerCase()) {
        return 15;
      }
      
      const length = word.length;
      switch (true) {
        case length <= 2:
          return 0;
        case length === 3:
          return 1;
        case length === 4:
          return 2;
        case length === 5:
          return 4;
        case length === 6:
          return 7;
        default:
          return 10;
      }
    };

    submitButton.addEventListener('click', submitWord);
    wordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitWord();
      }
    });

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

      const backspaceTile = document.createElement('div');
      backspaceTile.classList.add('tile', 'backspace');
      backspaceTile.innerText = '⌫';
      backspaceTile.addEventListener('click', () => {
        handleBackspace();
        animateTile(backspaceTile);
      });
      letterGrid.appendChild(backspaceTile);

      if (this.state.keyboardListener) {
        document.removeEventListener('keydown', this.state.keyboardListener);
      }

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

      const currentWordObj = this.state.words[this.state.currentRound];
      if (!currentWordObj) {
        endGame();
        return;
      }

      const letters = [...currentWordObj.word.toUpperCase()];
      const letterMap = new Map();
      letters.forEach(letter => {
        letterMap.set(letter, (letterMap.get(letter) || 0) + 1);
      });

      createLetterGrid(letterMap);
      this.state.currentRound++;
    };

    const endGame = () => {
      this.state.isGameActive = false;
      showSentencePhase();
    };

    const hideGameElements = () => {
      document.querySelector('#game-controls').style.display = 'none';
      document.querySelector('.game-header').style.display = 'none';
    };

    const showGameElements = () => {
      const gameControls = document.querySelector('#game-controls');
      const gameHeader = document.querySelector('.game-header');
      
      if (gameControls) {
        gameControls.style.display = 'flex';
      } else {
        console.error('Could not find #game-controls element');
      }
      
      if (gameHeader) {
        gameHeader.style.display = 'flex';
      } else {
        console.error('Could not find .game-header element');
      }
    };

    const showGameResults = () => {
      document.querySelector('#sentence-phase').style.display = 'none';
      hideGameElements();
      
      const summaryContainer = document.querySelector('#summary-container');
      summaryContainer.innerHTML = '';
      
      const resultsDiv = document.createElement('div');
      resultsDiv.classList.add('game-results');
    
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

      const finalSentence = this.state.finalSentence || 'No sentence created';

      window.parent.postMessage({
        type: 'devvit-message',
        data: {
          message: {
            type: 'gameComplete',
            data: {
              totalScore: this.state.totalScore,
              sentence: this.state.finalSentence,
              foundWords: Array.from(this.state.allFoundWords),
              username: this.state.username
            }
          }
        }
      }, '*');

      resultsDiv.innerHTML = `
        <h2>Game Over!</h2>
        <h3>Final Score: ${this.state.totalScore} points!</h3>
        <p class="bonus-note">(Including sentence bonus points)</p>
        <div class="round-breakdown">
          ${roundSummaries}
        </div>
        <h3 style="margin-top: 1rem;">Your Final Sentence:</h3>
        <p class="final-sentence">${finalSentence}</p>
        <p style="margin-top: 2rem;">You found ${this.state.allFoundWords.size} words:</p>
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

    const startGame = () => {
      console.log('Starting game');
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
        console.log('Received message:', message);

        if (message.type === 'initialData') {
          const { username, words, postId } = message.data;

          console.log('Received initial data:', { username, words, postId });
          
          this.state = {
            ...this.state,
            username,
            words,
            postId
          };
        }
      }
    });

    const showSentencePhase = () => {
      hideGameElements();
      letterGrid.innerHTML = '';
      
      const sentencePhase = document.querySelector('#sentence-phase');
      const summaryContainer = document.querySelector('#summary-container');
      summaryContainer.innerHTML = '';
      sentencePhase.style.display = 'flex';
      
      const wordsByRound = new Map();
      this.state.allFoundWords.forEach(word => {
        const roundIndex = this.state.roundWords.get(word);
        if (!wordsByRound.has(roundIndex)) {
          wordsByRound.set(roundIndex, new Set());
        }
        wordsByRound.get(roundIndex).add(word);
      });
      
      const foundWordsRef = sentencePhase.querySelector('.found-words-reference');
      foundWordsRef.innerHTML = '';
      
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
      
      const submitButton = document.querySelector('#submit-sentence');
      submitButton.addEventListener('click', () => {
        const sentence = document.querySelector('#sentence-input').value.toLowerCase();
        const words = sentence.split(/\s+/).filter(word => word.length > 0);
        
        if (words.length > 20) {
          showToast('Sentence cannot be longer than 20 words!');
          return;
        }

        let bonusPoints = 0;
        const usedWords = new Set();
        
        words.forEach(word => {
          if (this.state.allFoundWords.has(word) && !usedWords.has(word)) {
            bonusPoints += 3;
            usedWords.add(word);
            showToast(`+3 points for using "${word}"!`);
          }
        });
        
        this.state.totalScore += bonusPoints;
        
        this.state.finalSentence = sentence;
        
        sentencePhase.style.display = 'none';
        showGameResults();
      });
    };
  }
}

new App();
