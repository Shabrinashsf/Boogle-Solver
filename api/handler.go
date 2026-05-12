package api

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"unicode"
)

// TrieNode represents a single node in the Trie.
type TrieNode struct {
	children [26]*TrieNode
	isEnd    bool
}

// Trie holds the root node of the prefix tree.
type Trie struct {
	root *TrieNode
}

// Cell represents a position on the board.
type Cell struct {
	R int `json:"r"`
	C int `json:"c"`
}

// WordResult holds a found word and the path of cells that form it.
type WordResult struct {
	Word   string `json:"word"`
	Length int    `json:"length"`
	Path   []Cell `json:"path"`
}

// 8-directional movement: N, NE, E, SE, S, SW, W, NW
var directions = [8][2]int{
	{-1, 0}, {-1, 1}, {0, 1}, {1, 1},
	{1, 0}, {1, -1}, {0, -1}, {-1, -1},
}

// ────────────────────────────────────────────────────────────
// Request / Response shapes (matches PRD section 6)
// ────────────────────────────────────────────────────────────

type SolveRequest struct {
	Board     [][]string `json:"board"`
	Mode      string     `json:"mode"`       // "global" | "target"
	Target    string     `json:"target"`     // required when mode=target
	MinLength int        `json:"min_length"` // optional, used in global mode
}

type GlobalResponse struct {
	Mode    string       `json:"mode"`
	Results []WordResult `json:"results"`
	Meta    GlobalMeta   `json:"meta"`
}

type GlobalMeta struct {
	Total     int `json:"total"`
	MinLength int `json:"min_length"`
}

type TargetResponse struct {
	Mode   string `json:"mode"`
	Target string `json:"target"`
	Found  bool   `json:"found"`
	Path   []Cell `json:"path,omitempty"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

var (
	globalTrie  *Trie
	trieOnce    sync.Once
	trieLoadErr error
)

func NewTrie() *Trie {
	return &Trie{root: &TrieNode{}}
}

func (t *Trie) Insert(word string) {
	node := t.root
	for _, ch := range word {
		idx := ch - 'A'
		if idx < 0 || idx > 25 {
			return
		}
		if node.children[idx] == nil {
			node.children[idx] = &TrieNode{}
		}
		node = node.children[idx]
	}
	node.isEnd = true
}

func (t *Trie) SearchPrefix(prefix string) *TrieNode {
	node := t.root
	for _, ch := range prefix {
		idx := ch - 'A'
		if idx < 0 || idx > 25 || node.children[idx] == nil {
			return nil
		}
		node = node.children[idx]
	}
	return node
}

func (t *Trie) IsWord(word string) bool {
	node := t.SearchPrefix(word)
	return node != nil && node.isEnd
}

func (t *Trie) HasPrefix(prefix string) bool {
	return t.SearchPrefix(prefix) != nil
}

func NodeIsWord(node *TrieNode) bool {
	return node != nil && node.isEnd
}

func NodeHasChild(node *TrieNode, idx int) bool {
	return node != nil && node.children[idx] != nil
}

func SolveGlobal(board [][]string, trie *Trie, minLength int) []WordResult {
	rows := len(board)
	if rows == 0 {
		return nil
	}
	cols := len(board[0])

	var mu sync.Mutex
	var wg sync.WaitGroup
	found := make(map[string]WordResult)

	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			wg.Add(1)
			go func(startR, startC int) {
				defer wg.Done()

				visited := make([][]bool, rows)
				for i := range visited {
					visited[i] = make([]bool, cols)
				}

				local := make(map[string]WordResult)
				path := make([]Cell, 0, rows*cols)

				dfsGlobal(board, trie, visited, startR, startC, rows, cols, "", trie.root, path, minLength, local)

				if len(local) > 0 {
					mu.Lock()
					for word, result := range local {
						if _, exists := found[word]; !exists {
							found[word] = result
						}
					}
					mu.Unlock()
				}
			}(r, c)
		}
	}

	wg.Wait()

	results := make([]WordResult, 0, len(found))
	for _, v := range found {
		results = append(results, v)
	}
	return results
}

func dfsGlobal(
	board [][]string,
	trie *Trie,
	visited [][]bool,
	r, c, rows, cols int,
	current string,
	node *TrieNode,
	path []Cell,
	minLength int,
	results map[string]WordResult,
) {
	letter := board[r][c]
	if len(letter) != 1 {
		return
	}
	idx := int(letter[0] - 'A')
	if idx < 0 || idx > 25 {
		return
	}

	if !NodeHasChild(node, idx) {
		return
	}

	nextNode := node.children[idx]
	newWord := current + letter

	visited[r][c] = true
	newPath := append(path, Cell{R: r, C: c})

	if NodeIsWord(nextNode) && len(newWord) >= minLength {
		if _, dup := results[newWord]; !dup {
			pathCopy := make([]Cell, len(newPath))
			copy(pathCopy, newPath)
			results[newWord] = WordResult{
				Word:   newWord,
				Length: len(newWord),
				Path:   pathCopy,
			}
		}
	}

	for _, d := range directions {
		nr, nc := r+d[0], c+d[1]
		if nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc] {
			dfsGlobal(board, trie, visited, nr, nc, rows, cols, newWord, nextNode, newPath, minLength, results)
		}
	}

	visited[r][c] = false
}

func SolveTarget(board [][]string, target string) []Cell {
	rows := len(board)
	if rows == 0 || len(target) == 0 {
		return nil
	}
	cols := len(board[0])

	visited := make([][]bool, rows)
	for i := range visited {
		visited[i] = make([]bool, cols)
	}

	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			if board[r][c] == string(target[0]) {
				path := make([]Cell, 0, len(target))
				if result := dfsTarget(board, target, visited, r, c, rows, cols, 0, path); result != nil {
					return result
				}
			}
		}
	}
	return nil
}

func dfsTarget(
	board [][]string,
	target string,
	visited [][]bool,
	r, c, rows, cols int,
	index int,
	path []Cell,
) []Cell {
	if board[r][c] != string(target[index]) {
		return nil
	}

	visited[r][c] = true
	newPath := append(path, Cell{R: r, C: c})

	if index == len(target)-1 {
		result := make([]Cell, len(newPath))
		copy(result, newPath)
		visited[r][c] = false
		return result
	}

	for _, d := range directions {
		nr, nc := r+d[0], c+d[1]
		if nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc] {
			if res := dfsTarget(board, target, visited, nr, nc, rows, cols, index+1, newPath); res != nil {
				visited[r][c] = false
				return res
			}
		}
	}

	visited[r][c] = false
	return nil
}

func dictPath() string {
	candidates := []string{
		"api/dictionary.txt",
		"./api/dictionary.txt",
		"../api/dictionary.txt",
	}

	_, filename, _, ok := runtime.Caller(0)
	if ok {
		candidates = append([]string{filepath.Join(filepath.Dir(filename), "dictionary.txt")}, candidates...)
	}

	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	return candidates[0]
}

func loadTrie() (*Trie, error) {
	trieOnce.Do(func() {
		t := NewTrie()
		f, err := os.Open(dictPath())
		if err != nil {
			trieLoadErr = err
			return
		}
		defer f.Close()

		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			word := strings.TrimSpace(scanner.Text())
			if len(word) >= 3 {
				t.Insert(strings.ToUpper(word))
			}
		}
		if err := scanner.Err(); err != nil {
			trieLoadErr = err
			return
		}
		globalTrie = t
	})
	return globalTrie, trieLoadErr
}

func isAlpha(s string) bool {
	for _, r := range s {
		if !unicode.IsLetter(r) {
			return false
		}
	}
	return true
}

func validateBoard(board [][]string) (int, int, string) {
	rows := len(board)
	if rows < 3 || rows > 8 {
		return 0, 0, "board must have between 3 and 8 rows"
	}
	cols := len(board[0])
	if cols < 3 || cols > 8 {
		return 0, 0, "board must have between 3 and 8 columns"
	}
	for r, row := range board {
		if len(row) != cols {
			return 0, 0, "all board rows must have the same length"
		}
		for c, cell := range row {
			upper := strings.ToUpper(cell)
			if len(upper) != 1 || !isAlpha(upper) {
				return 0, 0, "invalid cell value at row " + string(rune('0'+r)) + " col " + string(rune('0'+c))
			}
			board[r][c] = upper
		}
	}
	return rows, cols, ""
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "only POST is allowed"})
		return
	}

	var req SolveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "invalid JSON: " + err.Error()})
		return
	}

	_, _, boardErr := validateBoard(req.Board)
	if boardErr != "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: boardErr})
		return
	}

	switch req.Mode {
	case "global", "target":
	default:
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "mode must be 'global' or 'target'"})
		return
	}

	if req.Mode == "target" {
		req.Target = strings.ToUpper(strings.TrimSpace(req.Target))
		if len(req.Target) < 3 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "target word must be at least 3 letters"})
			return
		}
		if !isAlpha(req.Target) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "target must contain only letters A-Z"})
			return
		}
	}

	if req.Mode == "global" {
		if req.MinLength == 0 {
			req.MinLength = 3
		}
		if req.MinLength < 3 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ErrorResponse{Error: "min_length must be at least 3"})
			return
		}
	}

	trie, err := loadTrie()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "failed to load dictionary: " + err.Error()})
		return
	}

	if trie == nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "dictionary not loaded"})
		return
	}

	switch req.Mode {
	case "global":
		results := SolveGlobal(req.Board, trie, req.MinLength)
		if results == nil {
			results = []WordResult{}
		}
		resp := GlobalResponse{
			Mode:    "global",
			Results: results,
			Meta: GlobalMeta{
				Total:     len(results),
				MinLength: req.MinLength,
			},
		}
		json.NewEncoder(w).Encode(resp)

	case "target":
		path := SolveTarget(req.Board, req.Target)
		resp := TargetResponse{
			Mode:   "target",
			Target: req.Target,
			Found:  path != nil,
			Path:   path,
		}
		json.NewEncoder(w).Encode(resp)
	}
}
