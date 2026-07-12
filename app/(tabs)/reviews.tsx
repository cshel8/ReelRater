import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { userStore } from '@/store/userStore';
import { reviewService } from '@/services';
import type { Review } from '@/types/domain';

export default function Review() {
    const { userId } = userStore();
    const [ movieTitle, setMovieTitle ] = useState('');
    const [ reviewText, setReviewText ] = useState('');
    const [ rating, setRating ] = useState('');
    const [ reviews, setReviews ] = useState<Review[]>([]);

    const fetchReviews = async () => {
        if ( !userId ) return;
        try {
            const userReviews = await reviewService.listForUser(userId);
            setReviews( userReviews );
        } catch ( error: any ) {
            console.log( 'Error fetching reviews:', error.message );
        }
    };
    useEffect(() => {
        fetchReviews();
    }, [ userId ]);
    const handleSubmit = async () => {
        if ( !movieTitle.trim() || !reviewText.trim() || !rating.trim()) {
            Alert.alert( 'Please fill in all field' );
            return;
        }
        if ( isNaN( Number( rating )) || Number( rating ) < 1 || Number( rating ) > 5 ) {
            Alert.alert( 'Rating must be a number between 1 and 5' );
            return;
        }
        if ( !userId ) return;
        try {
            const review = await reviewService.create(userId, {
                movieTitle,
                reviewText,
                rating,
            });
            setReviews([review, ...reviews]);
            setMovieTitle('');
            setReviewText('');
            setRating('');
            Alert.alert( 'Review Submitted!' );
        } catch ( error: any ) {
            Alert.alert( 'Error submitting review', error.message );
        }
    };
    const handleDelete = async ( id: string ) => {
        try {
            await reviewService.remove(id);
            setReviews( reviews.filter(( r ) => r.id !== id ));
        } catch ( error: any ) {
            Alert.alert( 'Error deleting review', error.message );
        }
    };
    return (
        <ScrollView contentContainerStyle = { styles.container }>
            <Text style = { styles.title }>Write a Review</Text>
            <Text style = { styles.label }>Movie Title</Text>
            <TextInput
                placeholder = "Movie title"
                value = { movieTitle }
                onChangeText = { setMovieTitle }
                style = { styles.input }
            />
            <Text style = { styles.label }>Your Review</Text>
            <TextInput
                placeholder = "Type your review here..."
                value = { reviewText }
                onChangeText = { setReviewText }
                style = {[ styles.input, { height: 100 }]}
                multiline
            />
            <Text style = { styles.label }>Raing (1-5)</Text>
            <TextInput
                placeholder = "Rating"
                value = { rating }
                onChangeText = { setRating }
                style = { styles.input }
                keyboardType = "numeric"
            />
            <Pressable
            onPress = { handleSubmit }
            style = {({ pressed }) => [
                styles.button, 
                pressed && styles.buttonPressed,
            ]}
            >
                <Text style = { styles.buttonText }>Submit Review</Text>
            </Pressable>
            { reviews.length > 0 && (
                <View style = { styles.reviewList }>
                    <Text style = { styles.subtitle }>Your Reviews:</Text>
                    { reviews.map(( r ) => (
                        <View key = { r.id } style = { styles.reviewItem }>
                            <Text style = { styles.reviewTitle }>
                                { r.movieTitle } ({ r.rating }/5 )
                            </Text>
                            <Text style = { styles.reviewText }>{r.reviewText}</Text>
                            <Pressable
                            onPress = {() => handleDelete( r.id )}
                            style= {({ pressed }) => [ 
                                styles.deleteButton,
                                pressed && styles.deleteButtonPressed,
                            ]}
                            >
                                <Text style = { styles.deleteButtonText }>Delete</Text>
                            </Pressable>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        alignSelf: 'flex-start',
        marginBottom: 4,
        marginTop: 8,
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 12,
        borderRadius: 6,
        marginBottom: 8,
        textAlignVertical: 'top',
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 8,
        marginTop: 12,
    },
    buttonPressed: {
        backgroundColor: "005BB5",
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
    },
    reviewList: {
        width: '100%',
        marginTop: 20,
    },
    reviewItem: {
        padding: 12,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        marginBottom: 10,
    },
    reviewTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
    },
    reviewText: {
        color: '#555',
    },
    deleteButton: {
        marginTop: 8,
        width: '100%',
        borderColor: '#FF3B30',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignSelf: 'flex-start',        
    },
    deleteButtonPressed: {
        backgroundColor: "#D32F2F",
    },
    deleteButtonText: {
        color: "white",
        fontWeight: '600',
    },
});
