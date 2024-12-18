import './createPost.js';
import { RedditFetcher } from './redditFetcher.js';
import { useAsync } from '@devvit/public-api';

import { Devvit, useState } from '@devvit/public-api';

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
    };
  // |  {
  //     type: 'updateWordCounts';
  //     data: {};
  //   }
  // | {
  //     type: 'sendUpdatedWords';
  //     data: { words: string[] };
  //   };

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

    // // Load latest counter from redis with `useAsync` hook
    // const [counter, setCounter] = useState(async () => {
    //   const redisCount = await context.redis.get(`counter_${context.postId}`);
    //   return Number(redisCount ?? 0);
    // });

    // Initialize RedditFetcher and get top words
    const fetcher = new RedditFetcher(context);
    const [topWords, setTopWords] = useState(async () => {
      const words = await fetcher.getTopWords(20) 
      return words ?? ['loading...'];
    });
//    const topWords = ['loading...'];
    const postId = context.postId ?? 'missing-post-id';

    // Create a reactive state for web view visibility
    const [webviewVisible, setWebviewVisible] = useState(false);

    // When the web view invokes `window.parent.postMessage` this function is called
    const onMessage = async (msg: WebViewMessage) => {
      switch (msg.type) {
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

    // When the button is clicked, send initial data to web view and show it
    const onShowWebviewClick = () => {
      setWebviewVisible(true);
      
      context.ui.webView.postMessage('myWebView', {
        type: 'initialData',
        data: {
          username,
          words: topWords, // topWords is already an array of {word, score} objects
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
            Example App
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

export default Devvit;
