#!/usr/bin/env zsh
# Consola de firmware de tablet y exploración de archivos

TABLET_SERIAL="SN-9A7B4C2D"
FIRMWARE_VER="1.0.7"
ANDROID_VER="14"

workspace_dir=$(pwd)

list_categorias() {
  echo "Imagenes:" 
  if [[ -d Imagenes ]]; then
    ls -1 Imagenes || true
  else
    echo "(sin carpeta Imagenes)"
  fi
  echo ""
  echo "Archivos:" 
  ls -1 | grep -v '^Imagenes$' | grep -v '^Imagenes/$'
}

banner() {
  clear
  echo "================= BIOS TABLET ================="
  echo " Serial:   $TABLET_SERIAL"
  echo " Firmware: $FIRMWARE_VER"
  echo " Android:  $ANDROID_VER"
  echo " Path:     $workspace_dir"
  echo "-----------------------------------------------"
  list_categorias
  echo "-----------------------------------------------"
  echo "Comandos: ls, cd <dir>, cat <file>, open <file>, find <patrón>, info, top, exit"
  echo "==============================================="
}

show_info() {
  echo "[INFO] Serial=$TABLET_SERIAL Firmware=$FIRMWARE_VER Android=$ANDROID_VER"
}

top_usage() {
  echo "Procesos activos:"
  printf '%-20s %-10s %-10s\n' "Proceso" "CPU%" "MEM%"
  printf '%-20s %-10s %-10s\n' "system_server" "12.3" "8.1"
  printf '%-20s %-10s %-10s\n' "surfaceflinger" "7.9" "3.5"
  printf '%-20s %-10s %-10s\n' "mediaserver" "3.1" "2.2"
  printf '%-20s %-10s %-10s\n' "console" "0.4" "0.7"
}

banner

while true; do
  echo -n "tablet> "
  read -r line || break
  setopt shwordsplit
  cmd=($line)
  case ${cmd[1]} in
    ls)
      ls -1 --color=auto || ls -1
      ;;
    cd)
      if [[ -z ${cmd[2]} ]]; then echo "Uso: cd <directorio>"; continue; fi
      if [[ -d ${cmd[2]} ]]; then cd "${cmd[2]}" && banner; else echo "No existe el directorio"; fi
      ;;
    cat)
      if [[ -z ${cmd[2]} ]]; then echo "Uso: cat <archivo>"; continue; fi
      if [[ -f ${cmd[2]} ]]; then sed -n '1,200p' "${cmd[2]}"; else echo "Archivo no encontrado"; fi
      ;;
    open)
      if [[ -z ${cmd[2]} ]]; then echo "Uso: open <archivo>"; continue; fi
      if [[ -e ${cmd[2]} ]]; then echo "Abriendo ${cmd[2]}..."; open "${cmd[2]}"; else echo "No existe"; fi
      ;;
    find)
      if [[ -z ${cmd[2]} ]]; then echo "Uso: find <patrón>"; continue; fi
      rg --files 2>/dev/null | grep -i "${cmd[2]}" || find . -iname "*${cmd[2]}*" -maxdepth 4
      ;;
    info)
      show_info
      ;;
    top)
      top_usage
      ;;
    exit|quit)
      echo "Saliendo de la consola de tablet."; break
      ;;
    "")
      continue
      ;;
    *)
      echo "Comando desconocido: ${cmd[1]}"
      ;;
  esac
  unset cmd
done
