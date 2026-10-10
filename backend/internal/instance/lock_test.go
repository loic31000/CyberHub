package instance

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRestartWithStalePID(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "cyber-hub.pid"), []byte("999999"), 0600); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "cyber-hub.lock")
	first, err := Acquire(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := first.Release(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("lock file should remain after release: %v", err)
	}
	second, err := Acquire(path)
	if err != nil {
		t.Fatalf("restart failed with stale files: %v", err)
	}
	defer second.Release()
}

func TestConcurrentProcessesAndCrashRecovery(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cyber-hub.lock")
	cmd := exec.Command(os.Args[0], "-test.run=^TestLockProcess$")
	cmd.Env = append(os.Environ(), "CYBER_HUB_LOCK_TEST_PATH="+path)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = cmd.Process.Kill(); _ = cmd.Wait() }()
	line, err := bufio.NewReader(stdout).ReadString('\n')
	if err != nil || strings.TrimSpace(line) != "locked" {
		t.Fatalf("child did not acquire lock: %q, %v", line, err)
	}
	if _, err := Acquire(path); !errors.Is(err, ErrAlreadyRunning) {
		t.Fatalf("concurrent instance: got %v, want ErrAlreadyRunning", err)
	}
	if err := cmd.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	if err := cmd.Wait(); err == nil {
		t.Fatal("child was expected to be terminated")
	}
	lock, err := Acquire(path)
	if err != nil {
		t.Fatalf("lock was not released after child exit: %v", err)
	}
	defer lock.Release()
}

func TestLockProcess(t *testing.T) {
	path := os.Getenv("CYBER_HUB_LOCK_TEST_PATH")
	if path == "" {
		return
	}
	lock, err := Acquire(path)
	if err != nil {
		t.Fatal(err)
	}
	defer lock.Release()
	fmt.Println("locked")
	time.Sleep(30 * time.Second)
}
