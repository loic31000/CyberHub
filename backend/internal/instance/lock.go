package instance

import (
	"errors"
	"fmt"

	"github.com/gofrs/flock"
)

var ErrAlreadyRunning = errors.New("une autre instance utilise déjà cette base")

// Lock reste détenu tant que le processus utilise la base de données.
// Le fichier peut survivre à un crash : seul le verrou du système fait autorité.
type Lock struct {
	file *flock.Flock
}

func Acquire(path string) (*Lock, error) {
	file := flock.New(path)
	locked, err := file.TryLock()
	if err != nil {
		return nil, fmt.Errorf("verrou d'instance: %w", err)
	}
	if !locked {
		return nil, ErrAlreadyRunning
	}
	return &Lock{file: file}, nil
}

func (l *Lock) Release() error {
	if l == nil || l.file == nil {
		return nil
	}
	return l.file.Unlock()
}
