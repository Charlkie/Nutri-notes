import {useEffect,useRef,useState,type ComponentProps} from "react";

type Props=Omit<ComponentProps<"input">,"type"|"value"|"onChange">&{
  value:number;
  onValueChange:(value:number)=>void;
};

export function NumericInput({value,onValueChange,onFocus,onBlur,onKeyDown,onBeforeInput,...props}:Props){
  const [text,setText]=useState(String(value));
  const focused=useRef(false);
  useEffect(()=>{if(!focused.current)setText(String(value))},[value]);
  return <input {...props} type="number" value={text} onFocus={event=>{focused.current=true;onFocus?.(event)}} onKeyDown={event=>{if(event.key==="Backspace"&&text==="0"){event.preventDefault();setText("")}onKeyDown?.(event)}} onBeforeInput={event=>{const native=event.nativeEvent as InputEvent;if(native.inputType==="deleteContentBackward"&&text==="0"){event.preventDefault();setText("")}onBeforeInput?.(event)}} onChange={event=>{const next=event.target.value;setText(next);if(next!==""){const parsed=Number(next);if(Number.isFinite(parsed))onValueChange(parsed)}}} onBlur={event=>{focused.current=false;if(text===""||!Number.isFinite(Number(text)))setText(String(value));onBlur?.(event)}}/>;
}
