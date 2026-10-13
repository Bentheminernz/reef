// nso related stuff
import type {
	AnnouncementFriendRequest,
	AnnouncementOperation,
	AnnouncementOperationContents
} from 'nxapi/coral';

export type NotificationOperationContents = AnnouncementOperationContents & {
	isFeatured?: boolean;
	isWebView?: boolean;
	webViewUri?: string;
};

export type NotificationOperation = Omit<AnnouncementOperation, 'operation'> & {
	operation: NotificationOperationContents;
	contentHtml: string;
};

export type Notification = NotificationOperation | AnnouncementFriendRequest;

// reef related stuff
export interface CoralSvelteNotice {
	id: string;
	title: string;
	content: string;
	contentHtml: string;
	requireAcknowledgement: boolean | null;
	category: 'News' | 'Update' | 'Maintenance' | 'Other';
	createdAt: Date;
	acknowledged: boolean;
}
