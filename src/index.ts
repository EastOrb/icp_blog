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
    updated_at: Opt<nat64>; // // updated time stamp of the blog post
}>


//define a Record to store the user input for the Post
type PostPayload = Record<{
    title: string;
    body: string;
    imageURL: string;
}>

/**
 * `postStorage` - it's a key-value datastructure that is used to store posts.
 * {@link StableBTreeMap} is a self-balancing tree that acts as a durable data storage that keeps data across canister upgrades.
 * For the sake of this contract we've chosen {@link StableBTreeMap} as a storage for the next reasons:
 * - `insert`, `get` and `remove` operations have a constant time complexity - O(1)
 * 
 * Brakedown of the `StableBTreeMap<string, Post>` datastructure:
 * - the key of map is a `postId`
 * - the value in this map is a post itself `post` that is related to a given key (`postId`)
 * 
 * Constructor values:
 * 1) 0 - memory id where to initialize a map
 * 2) 44 - it's a max size of the key in bytes (size of the uuid value that we use for ids).
 * 3) 1024 - it's a max size of the value in bytes. 
 * 2 and 3 are not being used directly in the constructor but the Azle compiler utilizes these values during compile time
 */
const postStorage = new StableBTreeMap<string, Post>(0, 44, 1024);

// get all posts
$query;
export function getPosts(): Result<Vec<Post>, string> {
    return Result.Ok(postStorage.values());
}


// get post by Id
$query;
export function getPost(id: string): Result<Post, string> {
    return match(postStorage.get(id), {
        Some: (post) => Result.Ok<Post, string>(post),
        None: () => Result.Err<Post, string>(`a post with id=${id} not found`)
    });
}


// add a new blog post
$update;
export function addPost(payload: PostPayload): Result<Post, string> {

    const { title, body, imageURL } = payload;

     // Input validation
     if (!title || !body || !imageURL) {
        return Result.Err<Post, string>('Missing required fields');
    }

    const post: Post = { 
        owner: ic.caller(),
        id: uuidv4(), 
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


// comment on a blog post

$update;
export function commentOnPost (id: string, comment: string): Result<Post, string> {
    const postResult = postStorage.get(id);

    return match(postResult, {
        Some: (post) => {
            const updatedPost: Post = {
                ...post,
                comments: [...post.comments, comment] 
            }

            postStorage.insert(id, updatedPost);

            return Result.Ok<Post, string>(updatedPost);
        },
        None: () => Result.Err<Post, string>("Post not found.")
    });
}



/**
 * Allow users to like a post
*/ 
$update
export function likePost(id: string): Result<Post, string> {
    return match(postStorage.get(id), {
        Some: (post) => {
            // if it is the owner, return an error
            if(post.owner.toString() === ic.caller().toString()){
                return Result.Err<Post, string>("Owners cannot like their post")
            }
            
            // if all checks have passed, increase the post likes by 1 and the updated_at property to the current timestamp
            const updatedPost: Post = {...post, likes: post.likes + 1, updated_at: Opt.Some(ic.time())}
            postStorage.insert(post.id, updatedPost)
            return Result.Ok<Post, string>(updatedPost)
        },
        None: () => Result.Err<Post, string>(`couldn't update a post with id=${id}. post not found`)
    })
}

 // update post
$update;
export function updatePost(id: string, payload: PostPayload): Result<Post, string> {
    return match(postStorage.get(id), {
        Some: (post) => {
            const updatedPost: Post = {...post, ...payload, updated_at: Opt.Some(ic.time())};
            postStorage.insert(post.id, updatedPost);
            return Result.Ok<Post, string>(updatedPost);
        },
        None: () => Result.Err<Post, string>(`couldn't update a post with id=${id}. post not found`)
    });
}


// delete post
$update;
export function deletePost(id: string): Result<Post, string> {
    return match(postStorage.remove(id), {
        Some: (deletedPost) => Result.Ok<Post, string>(deletedPost),
        None: () => Result.Err<Post, string>(`couldn't delete a post with id=${id}. post not found.`)
    });
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    }
};