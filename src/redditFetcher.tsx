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

  constructor(private readonly context: Context) {}

  // getTopWords returns the top words used in the subreddit.
  // The count parameter specifies how many words to return. If empty, current subreddit is used.
  async getTopWords(count: number = 20):  Promise<string[]> {
    await this.updateWordCounts();
    const subreddit = await this.context.reddit.getCurrentSubreddit();
    const wordsKey = `words:${subreddit.name}`;

    const topWords = await this.context.redis.zRange(wordsKey, 0, count - 1, { by: 'rank', reverse: true });
    return topWords.map(entry => entry.member);
  }

  private async updateWordCounts(): Promise<void> {
    const subreddit = await this.context.reddit.getCurrentSubreddit();
    const posts = await subreddit.getTopPosts({ timeframe: 'day', limit: 25 });

    // Get current post IDs and evict old posts IDs
    const currentPostIds = new Set<string>();
    for await (const post of posts) {
      currentPostIds.add(post.id);
    }
    await this.removeExpiredPosts(subreddit.name, currentPostIds);
  
    // Process new posts, evict old posts
    for await (const post of posts) {
      await this.processPost(subreddit.name, post);
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
    let text = post.title + ' ' + (post.body || '');
    const comments = post.comments;
    
    for await (const comment of comments) {
      text += ' ' + comment.body;
    }

    return this.countWords(text);
  }

  private countWords(text: string): Record<string, number> {
    return text.toLowerCase()
      .split(/\s+/) 
      .filter(word => !this.stopwords.has(word))
      .reduce((counts, word) => {
        counts[word] = (counts[word] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
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
    
    if (counts) {
      const wordCounts = JSON.parse(counts) as Record<string, number>;
      const wordsKey = `words:${subredditName}`;
      
      for (const [word, count] of Object.entries(wordCounts)) {
        await this.context.redis.zIncrBy(wordsKey, word, -count);
      }
      await this.context.redis.del(postKey);
    }
  }
}