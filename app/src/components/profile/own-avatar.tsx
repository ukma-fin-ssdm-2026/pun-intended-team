// Written with the help of Claude
import { Text, View } from 'react-native';

import { ApiPicture } from '@/components/pictures/picture';
import { useProfile } from '@/hooks/use-profile';

// The signed-in user's 40 px avatar beside a post: the photo, or the first letter of the name without one.
export function OwnAvatar() {
  const profile = useProfile().data;
  return (
    <View className="size-10 items-center justify-center overflow-hidden rounded-[20px] bg-brand-ink">
      {profile?.photo ? (
        <ApiPicture image={profile.photo} />
      ) : (
        <Text className="font-inter-semibold text-title text-text-on-dark">
          {profile?.displayName.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
