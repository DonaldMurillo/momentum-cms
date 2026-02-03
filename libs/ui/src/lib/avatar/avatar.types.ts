export type AvatarSize = 'sm' | 'md' | 'lg';

export const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
	sm: 'h-8 w-8 text-xs',
	md: 'h-10 w-10 text-sm',
	lg: 'h-12 w-12 text-base',
};
