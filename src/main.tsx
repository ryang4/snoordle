import './createPost.js';
import { RedditFetcher } from './redditFetcher.js';
import { Devvit, useState, Scheduler, JobContext } from '@devvit/public-api';

// Defines the messages that are exchanged between Devvit and Web View
type WebViewMessage =
  | {
      type: 'initialData';
      data: { 
        username: string;
        postId: string;
        words: Array<{word: string, score: number}>;
        debugData: any[]; // Add debug data to initial payload
      };
    }
  | {
      type: 'saveUserResults';
      data: { newCounter: number };
    }
  | {
      type: 'gameComplete';
      data: {
        totalScore: number;
        sentence: string;
        foundWords: string[];
        username: string;
      };
    };

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add a custom post type to Devvit
Devvit.addCustomPostType({
  name: 'Webview Example',
  height: 'tall',
  render: (context) => {
    // Load username with `useAsync` hook
    const [username] = useState(async () => {
      const currUser = await context.reddit.getCurrentUser();
      return currUser?.username ?? 'anon';
    });

    // Initialize RedditFetcher and get top words
    const fetcher = new RedditFetcher(context);
    const [topWords, setTopWords] = useState(async () => {
      await fetcher.refreshAllWords();
      const words = await fetcher.getTopWords(20);
      return words ?? ['loading...'];
    });

    const postId = context.postId ?? 'missing-post-id';

    // Create a reactive state for web view visibility
    const [webviewVisible, setWebviewVisible] = useState(false);

    // When the web view invokes `window.parent.postMessage` this function is called
    const onMessage = async (msg: WebViewMessage) => {
      switch (msg.type) {
        case 'gameComplete':
          try {
            const comment = await context.reddit.submitComment({
              id: context.postId ?? '',
              text: formatGameResult(msg.data)
            });
            console.log('Posted comment:', comment.id);
          } catch (error) {
            console.error('Error posting comment:', error);
          }
          break;
        case 'saveUserResults':
          break;
        // case 'updateWordCounts':
        //   await fetcher.updateWordCounts();
        //   setTopWords(await fetcher.getTopWords(20));
          
        //   context.ui.webView.postMessage('myWebView', {
        //     type: 'sendUpdatedWords',
        //     data: topWords,
        //   });
        //   break
        // case 'sendUpdatedWords':
        case 'initialData':
          break;
        default:
          throw new Error(`Unknown message type: ${msg satisfies never}`);
      }
    };

    const formatGameResult = (data: Extract<WebViewMessage, { type: 'gameComplete' }>['data']) => {
      const { totalScore, sentence, foundWords, username } = data;
      return `
u/${username}'s Snoordle Results:
- Final Score: ${totalScore} points
- Sentence: "${sentence}"
- Found Words: ${foundWords.join(', ')}
      `.trim();
    };

    // When the button is clicked, send initial data to web view and show it
    const onShowWebviewClick = () => {
      setWebviewVisible(true);
      
      console.log('Sending words to webview:', topWords); // Debug log
      
      context.ui.webView.postMessage('myWebView', {
        type: 'initialData',
        data: {
          username,
          words: topWords,
          postId,
        },
      });
    };

    // Render the custom post type
    return (
      <vstack grow padding="small">
        <vstack
          grow={!webviewVisible}
          height={webviewVisible ? '0%' : '100%'}
          alignment="middle center"
        >
          <text size="xlarge" weight="bold">
            Get Ready to Play Snoordle!
          </text>
          <spacer />
          <vstack alignment="start middle">
            <hstack>
              <text size="medium">Username:</text>
              <text size="medium" weight="bold">
                {' '}
                {username ?? ''}
              </text>
            </hstack>
            {/* <hstack>
              <text size="medium">Current counter:</text>
              <text size="medium" weight="bold">
                {' '}
                {counter ?? ''}
              </text>
            </hstack> */}
          </vstack>
          <spacer />
          <button onPress={onShowWebviewClick}>Launch App</button>
        </vstack>
        <vstack grow={webviewVisible} height={webviewVisible ? '100%' : '0%'}>
          <vstack border="thick" borderColor="black" height={webviewVisible ? '100%' : '0%'}>
            <webview
              id="myWebView"
              url="page.html"
              onMessage={(msg) => onMessage(msg as WebViewMessage)}
              grow
              height={webviewVisible ? '100%' : '0%'}
            />
          </vstack>
        </vstack>
      </vstack>
    );
  },
});

// Define the job
Devvit.addSchedulerJob({
  name: 'daily-word-refresh',
  onRun: async (event, context: JobContext) => {
    const fetcher = new RedditFetcher(context);
    await fetcher.refreshAllWords();
    console.log('Daily word refresh completed');
  },
});

// Add trigger to schedule the job daily
Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(event, context) {
    // Schedule initial job
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);  // Next midnight

    await context.scheduler.runJob({
      name: 'daily-word-refresh',
      cron: '0 0 * * *'
    });
    
    console.log('Word refresh job scheduled');
  }
});

export default Devvit;
