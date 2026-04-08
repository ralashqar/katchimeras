import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/utils/supabase';

type Todo = {
  id: number | string;
  name: string | null;
};

export default function HomeScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const getTodos = async () => {
      try {
        const { data, error } = await supabase.from('todos').select('id, name');

        if (error) {
          throw error;
        }

        if (isMounted) {
          setTodos((data as Todo[]) ?? []);
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          setErrorMessage(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    getTodos();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Todo List</ThemedText>
      {loading ? <ActivityIndicator size="large" style={styles.loader} /> : null}
      {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}
      {!loading && !errorMessage ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={todos}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={<ThemedText>No todos found.</ThemedText>}
          renderItem={({ item }) => (
            <ThemedView style={styles.todoItem}>
              <ThemedText>{item.name ?? 'Untitled todo'}</ThemedText>
            </ThemedView>
          )}
        />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  loader: {
    marginTop: 16,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  todoItem: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorText: {
    color: '#c62828',
  },
});
