class App {
  constructor() {
    const output = document.querySelector('#messageOutput');
    const usernameLabel = document.querySelector('#username');
    const postLabel = document.querySelector('#page-id');
    const wordsLabel = document.querySelector('#top-words');

    const sendToDevvit = (type, data) => {
      window.parent.postMessage({
        type: 'from-webview',
        data: { type, data }
      }, '*');
    };

    // When the Devvit app sends a message with `context.ui.webView.postMessage`, this will be triggered
    window.addEventListener('message', (ev) => {
      const { type, data } = ev.data;

      // Reserved type for messages sent via `context.ui.webView.postMessage`
      if (type === 'devvit-message') {
        const { message } = data;

        // Always output full message
        output.replaceChildren(JSON.stringify(message, undefined, 2));

        // Load initial data
        if (message.type === 'initialData') {
          const { username, words, postId } = message.data;
          usernameLabel.innerText = username;
          postLabel.innerText = postId;
        }

        // Load new words
        if (message.type === 'sendUpdatedWords') {
          const { words } = message.data;
          wordsLabel.innerText = words;
        }

        // // Update counter
        // if (message.type === 'updateCounter') {
        //   const { currentCounter } = message.data;
        //   counterLabel.innerText = currentCounter;
        // }
      }
    });

    updateButton.addEventListener('click', () => {
      sendToDevvit('updateWordCounts', {});
    });
  }
}

new App();
