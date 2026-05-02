import {
  getConversation,
  normalizeGetConversationInput,
  normalizeSendMessageInput,
  sendMessage,
} from "../queries/conversation.js";
import handleResponse from "../utils/handleResponse.js";

export async function sendMessageController(req: any, res: any) {
  const input = normalizeSendMessageInput(
    Number(req.user.user_id),
    req.params.matchId,
    req.body ?? {}
  );

  const result = await sendMessage(
    input.currentUserId,
    input.matchId,
    input.content
  );

  return handleResponse(res, 201, "Message sent successfully", result);
}

export async function getConversationController(req: any, res: any) {
  const input = normalizeGetConversationInput(
    Number(req.user.user_id),
    req.params.matchId
  );

  const result = await getConversation(input.currentUserId, input.matchId);

  return handleResponse(res, 200, "Conversation loaded successfully", result);
}
