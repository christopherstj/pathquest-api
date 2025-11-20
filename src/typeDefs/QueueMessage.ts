export default interface QueueMessage {
    user_id: string;
    action: string;
    created: string;
    started?: string;
    completed?: string;
    json_data?: string;
    is_webhook: boolean;
}
