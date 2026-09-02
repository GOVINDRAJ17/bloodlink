import { POST as requestsPOST, GET as requestsGET } from "../requests/route";

export async function POST(request: Request) {
  return requestsPOST(request);
}

export async function GET(request: Request) {
  return requestsGET(request);
}
