import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal } from 'azle';
import { v4 as uuidv4 } from 'uuid';

/**
 * This type represents a Post that can be written on the blog.
 */
type Post = Record<{
    owner: Principal; // owner of the blog post
    id: string; // id of the post
    title: string; // title of the blog post
    body: string; // Main body of the blog post
    imageURL: string; // image url of the blog post
    likes: number; // number of likes of the blog post
    comments: Vec<string>; // comments of the blog post
    created_at: nat64; // created time stamp of the blog post
    updated_at: Opt<nat64>; // updated time stamp of the blog post
}>

// Define a Record to store the user input for the Post
type PostPayload = Record<{
    title: string;
    body: string;
    imageURL: string;
}>

// Create a SecureUUIDGenerator to ensure uniqueness
class SecureUUIDGenerator {
    private generatedUUIDs: Set<string> = new Set<string>();

    generateUUID(): string {
        let newUUID: string;
        do {
            newUUID = uuidv4();
        } while (this.generatedUUIDs.has(newUUID));

        this.generatedUUIDs.add(newUUID);
        return newUUID;
    }
}

const secureUUIDGenerator = new SecureUUIDGenerator();

/**
 * `postStorage` - it's a key-value datastructure that is used to store posts.
 * ...
 */

const postStorage = new StableBTreeMap<string, Post>(0, 44, 1024);

// ...

// Add a new blog post
$update;
export function addPost(payload: PostPayload): Result<Post, string> {
    const { title, body, imageURL } = payload;

    // Input validation
    if (!title || !body || !imageURL) {
        return Result.Err<Post, string>('Missing required fields');
    }

    const post: Post = {
        owner: ic.caller(),
        id: secureUUIDGenerator.generateUUID(), // Use secure UUID generation
        likes: 0,
        comments: [],
        created_at: ic.time(),
        updated_at: Opt.None,
        title,
        body,
        imageURL
    };

    postStorage.insert(post.id, post);
    return Result.Ok(post);
}

// Like a post
$update;
export function likePost(id: string): Result<Post, string> {
    const post = postStorage.get(id);

    if (post === null) {
        return Result.Err<Post, string>(`Couldn't update post with id=${id}. Post not found`);
    }

    if (ic.caller().toString() === post.owner.toString()) {
        return Result.Err<Post, string>("Owners cannot like their own post");
    }

    const updatedPost: Post = {
        ...post,
        likes: post.likes + 1,
        updated_at: Opt.Some(ic.time())
    };

    postStorage.insert(post.id, updatedPost);
    return Result.Ok<Post, string>(updatedPost);
}

// ...

// Update a post
$update;
export function updatePost(id: string, payload: PostPayload): Result<Post, string> {
    const post = postStorage.get(id);

    if (post === null) {
        return Result.Err<Post, string>(`Couldn't update post with id=${id}. Post not found`);
    }

    if (ic.caller().toString() !== post.owner.toString()) {
        return Result.Err<Post, string>("Only the owner can update the post");
    }

    const updatedPost: Post = {
        ...post,
        ...payload,
        updated_at: Opt.Some(ic.time())
    };

    postStorage.insert(post.id, updatedPost);
    return Result.Ok<Post, string>(updatedPost);
}

// ...

// Delete a post
$update;
export function deletePost(id: string): Result<Post, string> {
    const post = postStorage.get(id);

    if (post === null) {
        return Result.Err<Post, string>(`Couldn't delete post with id=${id}. Post not found`);
    }

    if (ic.caller().toString() !== post.owner.toString()) {
        return Result.Err<Post, string>("Only the owner can delete the post");
    }

    postStorage.remove(id);
    return Result.Ok<Post, string>(post);
}
