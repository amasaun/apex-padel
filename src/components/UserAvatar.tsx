import { getInitials, getAvatarColor } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-24 h-24 text-2xl',
};

export default function UserAvatar({ name, photoUrl, size = 'md', className = '' }: UserAvatarProps) {
  const { bg, text } = getAvatarColor(name);
  const initials = getInitials(name);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${bg} ${text} rounded-full flex items-center justify-center font-semibold ${className}`}
    >
      {initials}
    </div>
  );
}
