import NextAuth from "next-auth";
import { authOptions } from "../../../../../server/authOptions";

const handler = NextAuth(authOptions);

export const GET = handler;
export const POST = handler;
export const HEAD = handler;
