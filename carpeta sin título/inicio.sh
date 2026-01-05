#!/usr/bin/env zsh
# inicio.sh - Muestra ubicación y menú para abrir BIOS y archivos

IP="189.233.10.12"
UA="curl/8.7.1"
LAT="19.6147"
LON="-98.9436"
CITY="Tepexpan"
URL="http://localhost:8000/?log=true"

print_location() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%S.%NZ")
  echo "=== UBICACIÓN / LOG ==="
  echo "$ts $IP $UA $LAT $LON $CITY $URL"
  echo "======================="
}

menu() {
  echo "Elige una opción:"\
  "\n 1) Abrir BIOS de tablet"\
  "\n 2) Abrir archivo (selección rápida)"\
  "\n 3) Salir"\
  ;
  echo -n "> "
}

open_bios() {
  if [[ -f "tablet_shell.sh" ]]; then
    echo "Lanzando BIOS..."; zsh ./tablet_shell.sh
  else
    echo "No se encontró 'tablet_shell.sh'."
  fi
}

open_file_menu() {
  echo "Archivos en el directorio:"; ls -1
  echo -n "Nombre de archivo a abrir (ENTER para cancelar): "
  read -r fname
  [[ -z $fname ]] && echo "Cancelado." && return
  if [[ -e $fname ]]; then
    echo "Abriendo '$fname'..."; open "$fname"
  else
    echo "Archivo no existe."
  fi
}

print_location
while true; do
  menu
  read -r opt || break
  case $opt in
    1) open_bios ;;
    2) open_file_menu ;;
    3) echo "Saliendo."; break ;;
    *) echo "Opción inválida." ;;
  esac
  echo "" # Separador
  print_location
done
