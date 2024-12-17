import { Devvit } from '@devvit/public-api';
import { RedditFetcher } from './redditFetcher.js';  // Add this import

// Configure Devvit's plugins
Devvit.configure({
  redditAPI: true,
});

// Adds a new menu item to the subreddit allowing to create a new post
Devvit.addMenuItem({
  label: 'Create New Snpoordle',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    
    const post = await reddit.submitPost({
      title: 'Play Snoordle!!',
      subredditName: subreddit.name,
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Analyzing subreddit words...</text>
        </vstack>
      ),
    });
    
    ui.showToast({ text: 'Created post!' });
    ui.navigateTo(post);
  },
});
