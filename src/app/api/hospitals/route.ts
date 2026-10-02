import { GET as nearbyGET } from "./nearby/route";

export async function GET(request: Request) {
  return nearbyGET(request);
}
