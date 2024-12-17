class App {
  constructor() {
    this.state = {
      words: [],
      username: '',
      postId: '',
      letterMap: new Map(),
      foundWords: new Set(),
    };

    const letterGrid = document.querySelector('#letter-grid');
    const wordInput = document.querySelector('#word-input');
    const submitButton = document.querySelector('#submit-word');
    const foundWordsList = document.querySelector('#found-words-list');
    const wordCountElement = document.querySelector('#word-count');
    const toast = document.querySelector('#toast');

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
      const word = wordInput.value.toLowerCase();
      if (word) {
        if (this.state.foundWords.has(word)) {
          showToast(`"${word}" has already been found!`);
        } else if (this.state.words.includes(word)) {
          this.state.foundWords.add(word);
          showToast(`Found "${word}"!`);
          updateFoundWordsList();
        }
        wordInput.value = '';
      }
    };

    submitButton.addEventListener('click', submitWord);
    wordInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
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

      // Add keyboard support
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          handleBackspace();
          animateTile(backspaceTile);
          return;
        }

        const pressedKey = e.key.toUpperCase();
        const tile = tiles.get(pressedKey);
        if (tile) {
          wordInput.value += pressedKey;
          animateTile(tile);
        }
      });

      // Animation helper
      const animateTile = (tile) => {
        tile.classList.add('active');
        setTimeout(() => tile.classList.remove('active'), 200);
      };
    };

    window.addEventListener('message', (ev) => {
      const { type, data } = ev.data;

      if (type === 'devvit-message') {
        const { message } = data;
        console.log('Received message:', message); // Add logging

        if (message.type === 'initialData') {
          const { username, words, postId } = message.data;
          processLetters(words);
          createLetterGrid(this.state.letterMap);

          this.state = {
            ...this.state,
            username,
            words,
            postId
          };
        }
      }
    });
  }
}

new App();
