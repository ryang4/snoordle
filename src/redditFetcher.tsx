import { Context, Post } from '@devvit/public-api';

export class RedditFetcher {
  private readonly stopwords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
    'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
    'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
    'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
    'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
    'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
    'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
    'take', 'people', 'into', 'year', 'your', 'good', 'some',
    'could', 'them', 'see', 'other', 'than', 'then', 'now',
    'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
    'well', 'way', 'even', 'new', 'want', 'because', 'any',
    'these', 'give', 'day', 'most', 'us'
  ]);

  private readonly GLOBAL_MODE_KEY = 'snoordle:globalMode';

  constructor(private readonly context: Context) {}

  // getTopWords returns the top words used in the subreddit.
  // The count parameter specifies how many words to return. If empty, current subreddit is used.
  async getTopWords(count: number = 20): Promise<{word: string, score: number}[]> {
    const isGlobal = await this.isGlobalMode();
    const source = isGlobal ? 'all' : await this.context.reddit.getCurrentSubreddit();
    const subredditName = source === 'all' ? 'all' : source.name;
    
    await this.cleanupRedis(subredditName);
    await this.updateWordCounts(subredditName);
    const wordsKey = `words:${subredditName}`;

    const topWords = await this.context.redis.zRange(wordsKey, 0, count - 1, { 
      by: 'rank',
      reverse: true,
    });
    
    return topWords.map(entry => ({
      word: entry.member,
      score: entry.score
    }));
  }

  async updateWordCounts(source: string): Promise<void> {
    // Use Reddit's search API to get top posts
    const posts = await this.context.reddit.search({
      subreddit: source,
      sort: 'top',
      time: 'day',
      limit: 25
    });

    const currentPostIds = new Set<string>();
    for await (const post of posts) {
      if (post.authorName !== 'snoordle-v2') {
        currentPostIds.add(post.id);
      }
    }

    await this.removeExpiredPosts(source, currentPostIds);

    for await (const post of posts) {
      if (post.authorName !== 'snoordle-v2') {
        await this.processPost(source, post);
      }
    }
  }
  
  private async removeExpiredPosts(subredditName: string, currentPostIds: Set<string>): Promise<void> {
    const activePostsKey = `posts:${subredditName}:active`;
    const activePosts = await this.context.redis.zRange(activePostsKey, 0, -1);
    
    // Find posts to remove (in active but not in current)
    const postsToRemove = activePosts.filter(post => 
      !currentPostIds.has(post.member)
    );
  
    // Remove expired posts and update counts
    for (const { member: postId } of postsToRemove) {
      await this.decrementPostCounts(subredditName, postId);
      await this.context.redis.zRem(activePostsKey, [postId]);
    }
  }

  private async processPost(subredditName: string, post: Post): Promise<void> {
    const activePostsKey = `posts:${subredditName}:active`;
    
    if (await this.context.redis.zScore(activePostsKey, post.id)) {
      return;
    } 

    const wordCounts = await this.countPostWords(post);
    
    // Store post counts
    await this.context.redis.set(
      `posts:${subredditName}:${post.id}`,
      JSON.stringify(wordCounts)
    );

    // Add to active posts
    await this.context.redis.zAdd(activePostsKey, {
      member: post.id,
      score: new Date(post.createdAt).getTime()
    });

    // Update word counts
    await this.incrementPostCounts(subredditName, wordCounts);
  }

  private async countPostWords(post: Post): Promise<Record<string, number>> {
    // Only use specific text content
    const textParts = [
      post.title || '',
      post.body || '',
    ];

    // Add comment bodies
    const comments = post.comments;
    comments.limit = 100;
    for await (const comment of comments) {
      if (comment.body) {
        textParts.push(comment.body);
      }
    }

    return this.countWords(textParts.join(' '));
  }

  private countWords(text: string): Record<string, number> {
    const cleanedText = this.cleanText(text);
    return cleanedText
      .split(/\s+/)
      .filter(word => 
        word.length > 0 && 
        !this.stopwords.has(word.toLowerCase())
      )
      .reduce((counts, word) => {
        const cleanWord = word.toLowerCase();
        counts[cleanWord] = (counts[cleanWord] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
  }

  private cleanText(text: string): string {
    return text
      .replace(/[[\].,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
      .replace(/\s{2,}/g, ' ') // Remove extra spaces
      .trim();
  }

  private async incrementPostCounts(subredditName: string, counts: Record<string, number>): Promise<void> {
    const wordsKey = `words:${subredditName}`;
    for (const [word, count] of Object.entries(counts)) {
      await this.context.redis.zIncrBy(wordsKey, word, count);
    }
  }

  private async decrementPostCounts(subredditName: string, postId: string): Promise<void> {
    const postKey = `posts:${subredditName}:${postId}`;
    const counts = await this.context.redis.get(postKey);

    if (!counts) {
      console.log('No counts found for post:', postKey);
      return;
    }

    try {
      const wordCounts = JSON.parse(counts) as Record<string, number>;
      const wordsKey = `words:${subredditName}`;
      
      console.log('Parsed word counts:', wordCounts);
      
      for (const [word, count] of Object.entries(wordCounts)) {
        const numericCount = Number(count);
        if (isNaN(numericCount)) {
          console.error('Invalid count for word:', word, count);
          continue;
        }
        
        console.log(`Decrementing '${word}' by ${numericCount}`);
        await this.context.redis.zIncrBy(wordsKey, word, numericCount * -1);
      }
      
      await this.context.redis.del(postKey);
    } catch (error) {
      console.error('Error processing counts:', error);
      console.error('Raw counts data:', counts);
      throw error;
    }
}

  private async cleanupRedis(subredditName: string): Promise<void> {
    // Get all Redis keys for this subreddit
    const keys = await this.context.redis.keys(`*${subredditName}*`);
    
    // Get current timestamp
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    for (const key of keys) {
      if (key.startsWith(`posts:${subredditName}:active`)) {
        // Clean up old posts from active set
        const posts = await this.context.redis.zRange(key, 0, -1, { withScores: true });
        const toRemove = posts.filter(post => post.score < oneDayAgo).map(post => post.member);
        
        if (toRemove.length > 0) {
          await this.context.redis.zRem(key, toRemove);
          
          // Clean up associated post data
          for (const postId of toRemove) {
            await this.decrementPostCounts(subredditName, postId);
            await this.context.redis.del(`posts:${subredditName}:${postId}`);
          }
        }
      }
    }
    
    // Reset word counts if they're older than a day
    const lastUpdateKey = `lastUpdate:${subredditName}`;
    const lastUpdate = await this.context.redis.get(lastUpdateKey);
    
    if (!lastUpdate || parseInt(lastUpdate) < oneDayAgo) {
      await this.context.redis.del(`words:${subredditName}`);
      await this.context.redis.set(lastUpdateKey, now.toString());
    }
  }

  async toggleGlobalMode(): Promise<boolean> {
    const currentMode = await this.context.redis.get(this.GLOBAL_MODE_KEY);
    const newMode = currentMode !== 'true';
    await this.context.redis.set(this.GLOBAL_MODE_KEY, newMode.toString());
    return newMode;
  }

  private async isGlobalMode(): Promise<boolean> {
    const mode = await this.context.redis.get(this.GLOBAL_MODE_KEY);
    return mode === 'true';
  }
}