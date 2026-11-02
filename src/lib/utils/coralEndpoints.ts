import { m } from '$lib/paraglide/messages';

const LABELS: Record<string, () => string> = {
	'/v4/User/ShowSelf': m.coral_endpoint_v4_user_show_self,
	'/v4/User/Show': m.coral_endpoint_v4_user_show,
	'/v3/User/Show': m.coral_endpoint_v3_user_show,
	'/v4/Friend/List': m.coral_endpoint_v4_friend_list,
	'/v4/Friend/Show': m.coral_endpoint_v4_friend_show,
	'/v3/Friend/CreateFriendCodeUrl': m.coral_endpoint_v3_friend_create_friend_code_url,
	'/v3/Friend/GetUserByFriendCode': m.coral_endpoint_v3_friend_get_user_by_friend_code,
	'/v3/Friend/GetUserByFriendCodeHash': m.coral_endpoint_v3_friend_get_user_by_friend_code_hash,
	'/v4/User/PlayLog/Show': m.coral_endpoint_v4_user_play_log_show,
	'/v4/Media/List': m.coral_endpoint_v4_media_list,
	'/v4/Media/Delete': m.coral_endpoint_v4_media_delete,
	'/v4/GameWebService/List': m.coral_endpoint_v4_game_web_service_list,
	'/v4/Announcement/List': m.coral_endpoint_v4_announcement_list,
	'/v4/Announcement/MarkAsRead': m.coral_endpoint_v4_announcement_mark_as_read,
	'/v5/Chat/List': m.coral_endpoint_v5_chat_list,
	'/v5/Hashtag/List': m.coral_endpoint_v5_hashtag_list,
	'/v4/FriendRequest/Create': m.coral_endpoint_v4_friend_request_create,
	'/v4/FriendRequest/Received/List': m.coral_endpoint_v4_friend_request_received_list,
	'/v4/FriendRequest/Received/Show': m.coral_endpoint_v4_friend_request_received_show,
	'/v4/FriendRequest/Received/MarkAsRead': m.coral_endpoint_v4_friend_request_received_mark_as_read,
	'/v3/FriendRequest/Accept': m.coral_endpoint_v3_friend_request_accept,
	'/v3/FriendRequest/Reject': m.coral_endpoint_v3_friend_request_reject,
	'/v3/FriendRequest/Cancel': m.coral_endpoint_v3_friend_request_cancel,
	'/v3/FriendRequest/Sent/List': m.coral_endpoint_v3_friend_request_sent_list,
	'/v3/Friend/Delete': m.coral_endpoint_v3_friend_delete,
	'/v3/Friend/Favorite/Create': m.coral_endpoint_v3_friend_favorite_create,
	'/v3/Friend/Favorite/Delete': m.coral_endpoint_v3_friend_favorite_delete,
	'/v4/Friend/Note/Update': m.coral_endpoint_v4_friend_note_update,
	'/v4/Friend/IsNew/Delete': m.coral_endpoint_v4_friend_is_new_delete,
	'/v3/User/Permissions/ShowSelf': m.coral_endpoint_v3_user_permissions_show_self,
	'/v4/User/Permissions/UpdateSelf': m.coral_endpoint_v4_user_permissions_update_self,
	'/v3/User/Block/List': m.coral_endpoint_v3_user_block_list,
	'/v3/User/Block/Create': m.coral_endpoint_v3_user_block_create,
	'/v3/User/Block/Delete': m.coral_endpoint_v3_user_block_delete,
	'/v4/NA/User/LoginFactor/Show': m.coral_endpoint_v4_na_user_login_factor_show,
	'/v5/PushNotification/Settings/List': m.coral_endpoint_v5_push_notification_settings_list,
	'/v5/PushNotification/Settings/Update': m.coral_endpoint_v5_push_notification_settings_update,
	'/v1/Event/GetActiveEvent': m.coral_endpoint_v1_event_get_active_event,
	'/v1/Event/Show': m.coral_endpoint_v1_event_show,
	'/v4/Account/GetToken': m.coral_endpoint_v4_account_get_token,
	'/v4/Game/GetWebServiceToken': m.coral_endpoint_v4_game_get_web_service_token
};


export function coralEndpointLabel(endpoint: string) {
	return LABELS[endpoint] ?? endpoint;
}
