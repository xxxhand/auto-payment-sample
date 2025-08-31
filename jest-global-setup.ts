/** Load environment variables */
import * as dotenv from 'dotenv';
import { expand } from 'dotenv-expand';
// 這是為了在env檔可以用${...}的方式
expand({ parsed: dotenv.config().parsed });
/** Load environment variables */

export default () => {
  console.log(`Run tests with db ${process.env.DEFAULT_MONGO_URI}`);
};
