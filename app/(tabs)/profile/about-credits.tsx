import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

const TMDB_URL = 'https://www.themoviedb.org';

export default function AboutCreditsScreen() {
  const openTmdb = async () => {
    try {
      await Linking.openURL(TMDB_URL);
    } catch {
      Alert.alert('Unable to open TMDB', 'Please try again later.');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.heading}>About ReelRater</Text>
        <Text style={styles.body}>
          ReelRater is a movie-review app for recording your own reviews and
          sharing them with your community.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Movie Data & Images</Text>
        <Image
          accessibilityLabel="The Movie Database logo"
          resizeMode="contain"
          source={require('../../../assets/tmdb-logo.png')}
          style={styles.tmdbLogo}
        />
        <Text style={styles.body}>
          Movie information and images are provided by TMDB.
        </Text>
        <Text style={styles.disclaimer}>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </Text>
        <Pressable
          accessibilityHint="Opens The Movie Database website"
          accessibilityRole="link"
          onPress={openTmdb}
          style={({ pressed }) => [
            styles.linkButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.linkButtonText}>Visit TMDB</Text>
          <Ionicons
            color={colors.reviewAccentText}
            name="open-outline"
            size={18}
          />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F8F8FA',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
  section: {
    borderWidth: 1,
    borderColor: '#E4E5E9',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  heading: {
    color: '#1F232B',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#555C68',
    fontSize: 15,
    lineHeight: 22,
  },
  tmdbLogo: {
    width: 220,
    height: 28,
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  disclaimer: {
    color: '#343A45',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
  },
  linkButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: 16,
    borderRadius: 9,
    backgroundColor: colors.reviewAccentSoft,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  linkButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
});
